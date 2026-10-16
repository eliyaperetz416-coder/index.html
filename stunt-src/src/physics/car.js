// Arcade car physics on a TrackPath.
//
// Two modes:
//  - ground: the car lives in track coordinates (s along the track, x across it). The track frame
//    carries it through loops, drops and banked turns, so it can never fall through the road.
//  - air: a free body in world space with (reduced) gravity. Each step it is projected back onto
//    the track to find where it would land.
// Crashes only cost speed. Falling off the world respawns the car on the road a moment later.

import { Vector3, Quaternion, Matrix4 } from 'three';
import { PHYSICS as P } from '../config/game.js';
import { Frame, F_SOLID, F_WALLS, F_LOOP, F_LAUNCH, F_LIP } from '../track/path.js';
import { clamp, damp } from '../core/math.js';

const _m = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();
const _v2 = new Vector3();
const _x = new Vector3();
const _up = new Vector3();
const AXIS_Y = new Vector3(0, 1, 0);

export class Car {
  /**
   * @param {import('../track/path.js').TrackPath} path
   * @param {object} stats effective stats (see config/cars.js effectiveStats)
   * @param {(type: string, data?: object) => void} emit event sink (effects, sound, score)
   */
  constructor(path, stats, emit = () => {}) {
    this.path = path;
    this.stats = stats;
    this.emit = emit;
    this.frame = new Frame();
    this.pos = new Vector3();
    this.vel = new Vector3();
    this.quat = new Quaternion();
    this.airBase = new Quaternion();
    this.angVel = new Vector3();
    this.proj = { s: 0, x: 0, h: 0, d2: 0 };
    this.reset(path.startS);
  }

  reset(s = this.path.startS, x = 0, v = 0) {
    this.mode = 'ground';
    this.s = s;
    this.x = x;
    this.h = 0;
    this.v = v;
    this.vx = 0;
    this.slip = 0; // visual yaw from sideways motion (rad)
    this.drift = 0; // extra visual yaw while drifting (rad)
    this.drifting = false;
    this.driftDir = 0;
    this.driftTime = 0;
    this.driftHold = 0;
    this.invuln = 0; // seconds of immunity after a hit
    this.airTime = 0;
    this.lastGroundS = s;
    this.boostTime = 0;
    this.boostPower = 0; // fraction of top speed added while boosting
    this.traction = 1; // < 1 on oil
    this.slick = 0; // seconds of low traction left
    this.tumble = 0; // seconds left of free spinning after a hit
    this.flip = null; // assisted flip during a jump
    this.angVel.set(0, 0, 0);
    this.throttle = 0;
    this.sync();
  }

  get speed() {
    return this.mode === 'ground' ? Math.hypot(this.v, this.vx) : this.vel.length();
  }

  /** Track distance of the car in either mode. */
  get trackS() {
    return this.mode === 'ground' ? this.s : this.proj.s;
  }

  get topSpeed() {
    return this.stats.topSpeed * (1 + (this.boostTime > 0 ? this.boostPower : 0));
  }

  /**
   * Short speed boost (pads and nitro). Stacks by taking the stronger one.
   * kick: also jump straight to near top speed (pads); off for the launch boost.
   */
  boost(power, duration, kick = true) {
    this.boostPower = Math.max(this.boostTime > 0 ? this.boostPower : 0, power);
    this.boostTime = Math.max(this.boostTime, duration);
    if (kick && this.mode === 'ground') this.v = Math.max(this.v, this.stats.topSpeed * (0.85 + power * 0.5));
  }

  /**
   * One physics step.
   * @param {number} dt seconds
   * @param {{throttle:number, steer:number, brake:number}} input
   */
  step(dt, input) {
    if (this.boostTime > 0) this.boostTime -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.slick > 0) this.slick -= dt;
    else if (this.traction < 1) this.traction = Math.min(1, this.traction + dt * 2.5);
    this.throttle = input.throttle;
    if (this.mode === 'ground') this.stepGround(dt, input);
    else this.stepAir(dt, input);
  }

  stepGround(dt, input) {
    const st = this.stats;
    const f = this.path.sampleAt(this.s, this.frame);
    const loop = (f.flags & F_LOOP) !== 0;
    const top = this.topSpeed;
    let v = this.v;

    // Along the track.
    let a = 0;
    if (input.throttle > 0 && v < top) {
      const r = v / top;
      a += st.accel * input.throttle * (1 - r * r) * (this.boostTime > 0 ? 1.8 : 1);
    }
    if (v > top) a -= (v - top) * P.overspeedDecay;
    if (input.brake > 0) a -= P.brakeDecel * input.brake;
    a -= v * P.coastDrag;
    a += -P.gravity * f.T.y * (loop ? P.loopGravityScale : P.slopeGravityScale);
    v += a * dt;
    if (loop && v < P.loopMinSpeed) v = P.loopMinSpeed;
    if (v < 0) v = 0;
    this.v = v;

    // Drift: hard steering at speed. Looser grip, wider slide, the tail swings out.
    this.updateDrift(dt, input, v);

    // Across the track: steering pulls the sideways speed towards a target; grip decides how fast.
    const speedFactor = 0.45 + 0.55 * Math.min(1, v / 25);
    const driftK = this.drifting ? 1.15 : 1;
    const target = input.steer * st.steerSpeed * speedFactor * driftK * (v > 1 ? 1 : v);
    this.vx += (target - this.vx) * damp(st.grip * this.traction * (this.drifting ? 0.55 : 1), dt);
    const ax = -v * v * f.kR * P.centrifugal + -P.gravity * f.R.y * P.lateralGravity * (loop ? 0 : 1);
    this.vx += ax * dt;
    this.x += this.vx * dt;
    this.s += v * dt;

    // Walls bounce the car back; no walls means it can drive off the edge.
    const hw = f.width / 2;
    const lim = hw - P.carHalfWidth;
    if (Math.abs(this.x) > lim) {
      const side = Math.sign(this.x);
      if (f.flags & F_WALLS) {
        const impact = this.vx * side;
        this.x = side * lim;
        if (impact > 0) {
          this.vx = -this.vx * P.wallRestitution - side * 1.2;
          this.v *= 1 - P.wallSpeedLoss * Math.min(1, impact / 6);
          this.emit('wall', { impact, side });
        }
      } else if (Math.abs(this.x) > hw + 0.4) {
        this.sync();
        this.launch(false);
        return;
      }
    }

    const next = this.path.flagsAt(this.s);
    if (!(next & F_SOLID)) {
      // Off the end of the road: leave along the lip's direction, not the gap's.
      this.sync(this.lastGroundS);
      this.launch(true);
      return;
    }
    this.lastGroundS = this.s;
    // Crests flagged as launchers throw the car when gravity can no longer hold it.
    if (f.flags & F_LAUNCH) {
      const grip = v * v * f.kU + P.gravity * f.U.y;
      if (grip < -P.launchThreshold) {
        this.sync();
        this.launch(false);
        return;
      }
    }
    this.sync();
  }

  updateDrift(dt, input, v) {
    const steer = input.steer;
    const want = Math.abs(steer) > 0.7 && v > 24 && this.traction > 0.9;
    this.driftHold = want ? this.driftHold + dt : 0;
    if (!this.drifting && this.driftHold > 0.18) {
      this.drifting = true;
      this.driftDir = Math.sign(steer);
      this.driftTime = 0;
      this.emit('driftStart', { dir: this.driftDir });
    }
    if (this.drifting) {
      this.driftTime += dt;
      if (Math.abs(steer) < 0.35 || Math.sign(steer) !== this.driftDir || v < 16) this.endDrift();
    }
    const target = this.drifting ? -this.driftDir * 0.42 : 0;
    this.drift += (target - this.drift) * damp(this.drifting ? 6 : 8, dt);
  }

  endDrift() {
    if (!this.drifting) return;
    this.drifting = false;
    this.emit('drift', { time: this.driftTime });
  }

  /** Recompute world position, velocity and orientation from track coordinates. */
  sync(frameS = this.s) {
    const f = this.path.sampleAt(frameS, this.frame);
    this.pos.copy(f.pos).addScaledVector(f.R, this.x);
    if (frameS !== this.s) this.pos.addScaledVector(f.T, this.s - frameS);
    this.vel.copy(f.T).multiplyScalar(this.v).addScaledVector(f.R, this.vx);
    this.slip = -Math.atan2(this.vx, Math.max(this.v, 6)) * 0.7;
    _x.copy(f.R).negate();
    _m.makeBasis(_x, f.U, f.T);
    this.quat.setFromRotationMatrix(_m);
    _q.setFromAxisAngle(AXIS_Y, this.slip + this.drift);
    this.quat.multiply(_q);
    this.proj.s = this.s;
    this.proj.x = this.x;
    this.proj.h = 0;
  }

  /** Leave the road. `fromEdge` = we reached the end of the solid road (a gap). */
  launch(fromEdge) {
    this.endDrift();
    this.mode = 'air';
    this.airTime = 0;
    this.airBase.copy(this.quat);
    this.proj.s = this.s;
    this.flip = null;
    const prev = this.path.flagsAt(this.s - 1);
    const gap = fromEdge ? this.path.gapAfter(this.s - 1) : null;
    if (gap && prev & F_LIP) this.jumpAssist(gap);
    this.emit('launch', { gap: !!gap });
  }

  /** Make a jump land on the landing ramp: never short, never far past it. */
  jumpAssist(gap) {
    const g = P.gravity * P.airGravityScale;
    const dir = _v.subVectors(gap.to, gap.from).setY(0).normalize();
    const vh = Math.max(1, this.vel.dot(dir));
    const vy = this.vel.y;
    const drop = gap.drop;
    const land = this.path.segments.slice(gap.index + 1, gap.index + 3).reduce((a, s) => a + s.length, 0);
    const dMin = gap.length + P.jumpMargin;
    const dMax = gap.length + Math.max(P.jumpMargin + 4, Math.min(70, land * 0.7));
    const range = (k) => {
      const y = vy * k;
      const t = (y + Math.sqrt(Math.max(0, y * y + 2 * g * drop))) / g;
      return vh * k * t;
    };
    let tAir;
    if (range(1) < dMin) {
      // Too slow: scale the launch velocity up until it clears the gap.
      let lo = 1;
      let hi = 6;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (range(mid) < dMin) lo = mid;
        else hi = mid;
      }
      this.vel.multiplyScalar(hi);
      tAir = dMin / (vh * hi);
    } else if (range(1) > dMax) {
      // Too fast: flatten the arc so it still comes down on the landing.
      const t = dMax / vh;
      const ny = (0.5 * g * t * t - drop) / t;
      this.vel.y = ny;
      tAir = t;
    } else {
      tAir = range(1) / vh;
    }
    if (gap.flips || gap.rolls) {
      this.flip = { flips: gap.flips, rolls: gap.rolls, t: 0, duration: tAir * 0.92 };
    }
  }

  stepAir(dt, input) {
    const g = P.gravity * P.airGravityScale;
    this.airTime += dt;
    this.vel.y -= g * dt;
    this.vel.multiplyScalar(1 - P.airDrag * dt);
    const f = this.path.sampleAt(this.proj.s, this.frame);
    // A little steering in the air, along the track's sideways direction.
    this.vel.addScaledVector(f.R, input.steer * P.airControl * this.stats.airControl * dt);
    this.pos.addScaledVector(this.vel, dt);

    const ahead = 20 + this.vel.length() * dt * 4;
    const pr = this.path.project(this.pos, this.proj.s, 12, ahead, this.proj);
    this.h = pr.h;
    this.orientAir(dt, f);

    const flags = this.path.flagsAt(pr.s);
    const hw = this.path.widthAt(pr.s) / 2;
    const fr = this.path.sampleAt(pr.s, this.frame);
    const vn = this.vel.dot(fr.U);
    // Just after take-off the road is still right below us: only land once we really touch it.
    const touch = this.airTime > 0.15 ? 0.05 : -0.02;
    if (flags & F_SOLID && Math.abs(pr.x) < hw + 0.3 && pr.h <= touch && pr.h > -4 && vn < 2) {
      this.land(pr, fr, vn);
      return;
    }
    // Walls still bounce the car while it skims along the road.
    if (flags & F_WALLS && pr.h < 1.4 && pr.h > -1 && Math.abs(pr.x) > hw - P.carHalfWidth && Math.abs(pr.x) < hw + 0.6) {
      const side = Math.sign(pr.x);
      const vr = this.vel.dot(fr.R) * side;
      if (vr > 0) {
        this.vel.addScaledVector(fr.R, -side * vr * (1 + P.wallRestitution));
        this.emit('wall', { impact: vr, side });
      }
    }
    if (pr.h < -P.fallDepth || this.airTime > P.maxAirTime || this.pos.y < this.path.minY - P.fallDepth * 2) this.respawn();
  }

  orientAir(dt, f) {
    _up.copy(f.U);
    if (this.tumble > 0) {
      // Free spin after a hit.
      this.tumble -= dt;
      const w = this.angVel.length();
      if (w > 1e-4) {
        _q.setFromAxisAngle(_v.copy(this.angVel).divideScalar(w), w * dt);
        this.quat.premultiply(_q);
      }
      this.angVel.multiplyScalar(Math.exp(-0.8 * dt));
      if (this.tumble <= 0) this.airBase.copy(this.quat);
      return;
    }
    // Nose follows the flight path; up follows the road below.
    const fwd = _v.copy(this.vel).normalize();
    const y = _v2.copy(_up).addScaledVector(fwd, -_up.dot(fwd)).normalize();
    _x.crossVectors(y, fwd);
    _m.makeBasis(_x, y, fwd);
    _q.setFromRotationMatrix(_m);
    this.airBase.slerp(_q, damp(this.flip ? 6 : 3.5, dt));
    this.quat.copy(this.airBase);
    if (this.flip) {
      const fl = this.flip;
      fl.t += dt;
      const k = Math.min(1, fl.t / fl.duration);
      const e = k * k * (3 - 2 * k);
      if (fl.flips) {
        // Local right is -X; a positive angle about it lifts the nose: flips > 0 are backflips.
        _q.setFromAxisAngle(_v.set(-1, 0, 0), Math.sign(fl.flips) * 2 * Math.PI * Math.abs(fl.flips) * e);
        this.quat.multiply(_q);
      }
      if (fl.rolls) {
        _q.setFromAxisAngle(_v.set(0, 0, 1), Math.sign(fl.rolls) * 2 * Math.PI * Math.abs(fl.rolls) * e);
        this.quat.multiply(_q);
      }
      if (k >= 1 && !fl.done) {
        fl.done = true;
        this.emit('flip', { flips: Math.abs(fl.flips), rolls: Math.abs(fl.rolls) });
      }
    }
  }

  land(pr, f, vn) {
    _up.set(0, 1, 0).applyQuaternion(this.quat);
    const upDot = _up.dot(f.U);
    const hw = f.width / 2 - P.carHalfWidth;
    this.mode = 'ground';
    this.s = pr.s;
    this.x = clamp(pr.x, -hw, hw);
    this.v = Math.max(6, this.vel.dot(f.T));
    this.vx = clamp(this.vel.dot(f.R), -8, 8) * 0.5;
    this.tumble = 0;
    this.angVel.set(0, 0, 0);
    const airTime = this.airTime;
    const flip = this.flip;
    this.flip = null;
    this.airTime = 0;
    if (upDot < P.crashUpDot) {
      this.v *= P.crashSpeedFactor;
      this.emit('crash', { reason: 'landing' });
    } else {
      const impact = -vn;
      if (impact > P.hardLandingSpeed) this.v *= 0.96;
      this.emit('land', { airTime, impact, flip });
    }
    this.sync();
  }

  respawn() {
    const s = this.path.nextSolid(Math.max(this.proj.s, this.lastGroundS)) + 3;
    const v = Math.max(P.respawnMinSpeed, this.speed * P.respawnSpeedFactor);
    this.reset(Math.min(s, this.path.length - 1), 0, v);
    this.emit('respawn', {});
  }

  /** Oil: grip drops to `traction` and stays low for `linger` seconds after leaving the slick. */
  oil(traction, linger) {
    this.traction = Math.min(this.traction, traction);
    this.slick = linger;
    this.endDrift();
  }

  /**
   * Knock the car (hazards, rivals). Never ends the race: it just costs speed.
   * @param {{slow?:number, push?:number, pop?:number, spin?:number}} hit
   *  slow: fraction of speed kept, push: sideways m/s (+ right), pop: upward m/s, spin: rad/s tumble
   */
  hit({ slow = 0.5, push = 0, pop = 0, spin = 0 } = {}) {
    const mass = this.stats.mass ?? 1;
    const k = 1 / mass;
    if (this.mode === 'ground') {
      this.v *= slow;
      this.vx += push * k;
      if (pop > 0) {
        this.sync();
        const f = this.frame;
        this.vel.addScaledVector(f.U, pop * k);
        this.launch(false);
      }
    } else {
      this.vel.multiplyScalar(slow);
      this.vel.addScaledVector(this.frame.R, push * k);
      this.vel.y += pop * k;
    }
    if (spin && this.mode === 'air') {
      this.tumble = 1.2;
      this.angVel.set((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2).normalize().multiplyScalar(spin * k);
    }
    this.boostTime = 0;
  }
}
