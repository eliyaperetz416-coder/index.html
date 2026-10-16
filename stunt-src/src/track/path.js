// TrackPath: the track centreline sampled every STEP metres, with a full frame per sample.
// Pure simulation code (no rendering). The car physics, hazards, AI and the mesh builder all
// read the track through this class.
//
// Frame per sample: T forward, U surface normal ("up" for the car), R to the driver's right.
// A car at track coordinates (s, x, h) sits at  P(s) + R(s)*x + U(s)*h.

import { Vector3 } from 'three';
import { compilePieces, F_SOLID, F_WALLS, F_LOOP, F_LAUNCH, F_LIP, F_START, F_FINISH, DEFAULT_WIDTH } from './pieces.js';
import { smooth } from '../core/math.js';

export const STEP = 0.5;
const WIDTH_BLEND = 12; // metres to blend between piece widths

export { F_SOLID, F_WALLS, F_LOOP, F_LAUNCH, F_LIP, F_START, F_FINISH };

/** Reusable output object for sampleAt(). */
export class Frame {
  constructor() {
    this.pos = new Vector3();
    this.T = new Vector3();
    this.U = new Vector3();
    this.R = new Vector3();
    this.width = DEFAULT_WIDTH;
    this.flags = 0;
    this.kU = 0;
    this.kR = 0;
    this.index = 0;
  }
}

export class TrackPath {
  constructor(def) {
    this.def = def;
    this.segments = compilePieces(def.pieces);
    this.build(def.origin ?? [0, 0, 0], (def.heading ?? 0) * (Math.PI / 180));
  }

  build(origin, heading) {
    // Round every segment to whole samples so each integration step lies in one segment.
    let total = 0;
    for (const sg of this.segments) {
      if (sg.gap) {
        sg.span = Math.hypot(sg.length, sg.drop); // distance along s through the gap
      } else {
        sg.span = sg.length;
      }
      sg.steps = Math.max(1, Math.round(sg.span / STEP));
      sg.s0 = total;
      total += sg.steps * STEP;
      sg.s1 = total;
    }
    const n = Math.round(total / STEP) + 1;
    this.count = n;
    this.length = total;
    const f = (k) => new Float32Array(n * k);
    this.P = f(3);
    this.T = f(3);
    this.U = f(3);
    this.R = f(3);
    this.kU = f(1);
    this.kR = f(1);
    this.W = f(1);
    this.flags = new Uint8Array(n);
    this.seg = new Uint16Array(n);

    const pos = new Vector3(...origin);
    let pitch = 0;
    let yaw = heading;
    let width = DEFAULT_WIDTH;
    let prevWidth = width;
    let widthBlendStart = -1e9;
    const T = new Vector3();
    const R = new Vector3();
    const U = new Vector3();
    let i = 0;
    let minY = Infinity;
    let maxY = -Infinity;

    const write = (sg, si, t) => {
      // Base frame from pitch/yaw. R stays horizontal so frames never drift.
      const cp = Math.cos(pitch);
      T.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp);
      R.set(-Math.cos(yaw), 0, Math.sin(yaw));
      U.crossVectors(R, T);
      let bank = 0;
      if (sg.bank) {
        const e = t < 0.25 ? smooth(t / 0.25) : t > 0.75 ? smooth((1 - t) / 0.25) : 1;
        bank = sg.bank * e;
      }
      const cb = Math.cos(bank);
      const sb = Math.sin(bank);
      const o = si * 3;
      this.P[o] = pos.x; this.P[o + 1] = pos.y; this.P[o + 2] = pos.z;
      this.T[o] = T.x; this.T[o + 1] = T.y; this.T[o + 2] = T.z;
      this.U[o] = U.x * cb + R.x * sb; this.U[o + 1] = U.y * cb + R.y * sb; this.U[o + 2] = U.z * cb + R.z * sb;
      this.R[o] = R.x * cb - U.x * sb; this.R[o + 1] = R.y * cb - U.y * sb; this.R[o + 2] = R.z * cb - U.z * sb;
      const pr = sg.gap ? 0 : sg.pitch / (sg.steps * STEP);
      const yr = sg.gap ? 0 : sg.yaw / (sg.steps * STEP);
      this.kU[si] = pr * cb - yr * cp * sb;
      this.kR[si] = -pr * sb - yr * cp * cb;
      const s = si * STEP;
      const wb = (s - widthBlendStart) / WIDTH_BLEND;
      this.W[si] = wb < 1 ? prevWidth + (width - prevWidth) * smooth(Math.max(0, wb)) : width;
      this.flags[si] = sg.gap ? 0 : sg.flags;
      this.seg[si] = sg.index;
      if (pos.y < minY) minY = pos.y;
      if (pos.y > maxY) maxY = pos.y;
    };

    this.segments.forEach((sg, index) => {
      sg.index = index;
      const w = sg.width ?? DEFAULT_WIDTH; // width applies to its own piece only
      if (w !== width) {
        prevWidth = this.W[Math.max(0, i - 1)] || width;
        width = w;
        widthBlendStart = sg.s0;
      }
      if (sg.gap) {
        // Straight line from the lip to the landing, then snap the pitch to the landing slope.
        const dir = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(sg.length);
        dir.y -= sg.drop;
        sg.from = pos.clone();
        const stepVec = dir.clone().divideScalar(sg.steps);
        const savedPitch = pitch;
        pitch = Math.atan2(dir.y, sg.length);
        for (let k = 0; k < sg.steps; k++) {
          write(sg, i++, k / sg.steps);
          pos.add(stepVec);
        }
        sg.to = pos.clone();
        pitch = sg.landPitch ?? savedPitch;
        return;
      }
      const ds = STEP;
      const pr = sg.pitch / (sg.steps * ds);
      const yr = sg.yaw / (sg.steps * ds);
      const lat = sg.lateral;
      for (let k = 0; k < sg.steps; k++) {
        const t = k / sg.steps;
        write(sg, i++, t);
        // Midpoint integration keeps loops closed.
        const pm = pitch + pr * ds * 0.5;
        const ym = yaw + yr * ds * 0.5;
        const cpm = Math.cos(pm);
        pos.x += Math.sin(ym) * cpm * ds;
        pos.y += Math.sin(pm) * ds;
        pos.z += Math.cos(ym) * cpm * ds;
        if (lat) {
          const d = lat * (smooth((k + 1) / sg.steps) - smooth(k / sg.steps));
          pos.x += -Math.cos(yaw) * d;
          pos.z += Math.sin(yaw) * d;
        }
        pitch += pr * ds;
        yaw += yr * ds;
      }
    });
    // Last sample closes the final segment.
    const last = this.segments[this.segments.length - 1];
    write(last, i, 1);
    this.minY = minY;
    this.maxY = maxY;

    const start = this.segments.find((s) => s.flags & F_START);
    const finish = this.segments.find((s) => !s.gap && s.flags & F_FINISH);
    this.startS = start ? Math.min(start.s1 - 4, 10) : 10;
    this.finishS = finish ? finish.s0 : this.length - 30;
    this.gaps = this.segments.filter((s) => s.gap);
  }

  /** Index of the sample at or before s. */
  indexAt(s) {
    const i = Math.floor(s / STEP);
    return i < 0 ? 0 : i >= this.count - 1 ? this.count - 2 : i;
  }

  flagsAt(s) {
    return this.flags[Math.min(this.count - 1, Math.max(0, Math.round(s / STEP)))];
  }

  widthAt(s) {
    return this.W[this.indexAt(s)];
  }

  /** Interpolated frame at distance s. Writes into `out` (a Frame) and returns it. */
  sampleAt(s, out = new Frame()) {
    const i = this.indexAt(s);
    const t = Math.min(1, Math.max(0, s / STEP - i));
    const a = i * 3;
    const b = a + 3;
    const L = (arr, v) => v.set(arr[a] + (arr[b] - arr[a]) * t, arr[a + 1] + (arr[b + 1] - arr[a + 1]) * t, arr[a + 2] + (arr[b + 2] - arr[a + 2]) * t);
    L(this.P, out.pos);
    L(this.T, out.T).normalize();
    L(this.U, out.U).normalize();
    L(this.R, out.R).normalize();
    out.width = this.W[i] + (this.W[i + 1] - this.W[i]) * t;
    out.flags = this.flags[t < 0.5 ? i : i + 1];
    out.kU = this.kU[i];
    out.kR = this.kR[i];
    out.index = i;
    return out;
  }

  /** World position of track coordinates (s, x, h). */
  pointAt(s, x = 0, h = 0, out = new Vector3()) {
    const f = this.sampleAt(s, _frame);
    return out.copy(f.pos).addScaledVector(f.R, x).addScaledVector(f.U, h);
  }

  /**
   * Nearest track point to a world position, searching s in [sHint - back, sHint + ahead].
   * Returns { s, x, h } in `out` (track coordinates of pos).
   */
  project(pos, sHint, back = 20, ahead = 40, out = { s: 0, x: 0, h: 0, d2: 0 }) {
    const P = this.P;
    let i0 = Math.max(0, Math.floor((sHint - back) / STEP));
    let i1 = Math.min(this.count - 1, Math.ceil((sHint + ahead) / STEP));
    let best = i0;
    let bestD = Infinity;
    const coarse = 4;
    for (let i = i0; i <= i1; i += coarse) {
      const o = i * 3;
      const dx = pos.x - P[o], dy = pos.y - P[o + 1], dz = pos.z - P[o + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    i0 = Math.max(0, best - coarse);
    i1 = Math.min(this.count - 1, best + coarse);
    for (let i = i0; i <= i1; i++) {
      const o = i * 3;
      const dx = pos.x - P[o], dy = pos.y - P[o + 1], dz = pos.z - P[o + 2];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    const o = best * 3;
    const dx = pos.x - P[o], dy = pos.y - P[o + 1], dz = pos.z - P[o + 2];
    const along = dx * this.T[o] + dy * this.T[o + 1] + dz * this.T[o + 2];
    const s = Math.min(this.length, Math.max(0, best * STEP + Math.max(-STEP * 2, Math.min(STEP * 2, along))));
    const f = this.sampleAt(s, _frame);
    const ex = pos.x - f.pos.x, ey = pos.y - f.pos.y, ez = pos.z - f.pos.z;
    out.s = s;
    out.x = ex * f.R.x + ey * f.R.y + ez * f.R.z;
    out.h = ex * f.U.x + ey * f.U.y + ez * f.U.z;
    out.d2 = bestD;
    return out;
  }

  /** The gap segment that starts right after s (within `within` metres), if any. */
  gapAfter(s, within = 4) {
    for (const g of this.gaps) if (g.s0 >= s - 1 && g.s0 - s <= within) return g;
    return null;
  }

  /** First solid s at or after s. */
  nextSolid(s) {
    for (let i = Math.max(0, Math.round(s / STEP)); i < this.count; i++) if (this.flags[i] & F_SOLID) return i * STEP;
    return this.length;
  }

  /** Start and end s of a piece (by index in def.pieces). */
  pieceRange(index) {
    let s0 = Infinity;
    let s1 = -Infinity;
    for (const sg of this.segments) {
      if (sg.piece === index) {
        s0 = Math.min(s0, sg.s0);
        s1 = Math.max(s1, sg.s1);
      }
    }
    return [s0, s1];
  }
}

const _frame = new Frame();
