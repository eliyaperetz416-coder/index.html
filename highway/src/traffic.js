// Pooled traffic. Cars are created once up front and recycled - no allocation during play.
import * as THREE from 'three';
import { CFG } from './config.js';
import { TRAFFIC_TYPES, TRAFFIC_COLORS } from './data/traffic.js';
import { models } from './models.js';
import { laneX } from './world.js';

const POOL_PER_TYPE = { sedan: 12, hatch: 10, suv: 8, van: 6, truck: 4 };

export class Traffic {
  constructor(scene, worldDef) {
    this.scene = scene; this.world = worldDef;
    this.root = new THREE.Group(); scene.add(this.root);
    this.pools = new Map();   // typeId -> free list
    this.active = [];
    this.laneState = worldDef.lanes.map(() => ({ sinceSpawn: 0, gap: 40 }));
    this.events = [];         // reused array handed out by update()
    this._total = TRAFFIC_TYPES.reduce((a, t) => a + t.weight, 0);
    for (const t of TRAFFIC_TYPES) {
      const list = [];
      const n = POOL_PER_TYPE[t.id] ?? 6;
      for (let i = 0; i < n; i++) {
        const obj = models.createVehicle(t.model, TRAFFIC_COLORS[i % TRAFFIC_COLORS.length]);
        obj.visible = false; this.root.add(obj);
        list.push({ obj, type: t, len: t.model.length, wid: t.model.width, lane: 0, x: 0, z: 0, relSpeed: 0, minDx: 99, scored: false, hit: false });
      }
      this.pools.set(t.id, list);
    }
  }

  reset() {
    for (const c of this.active) this._release(c);
    this.active.length = 0;
    this.laneState.forEach((l) => { l.sinceSpawn = Math.random() * 30; l.gap = 40; });
  }

  _pick() {
    let r = Math.random() * this._total;
    for (const t of TRAFFIC_TYPES) { r -= t.weight; if (r <= 0) return t; }
    return TRAFFIC_TYPES[0];
  }
  _release(c) { c.obj.visible = false; this.pools.get(c.type.id).push(c); }

  _relSpeed(lane, playerSpeed) {
    const l = this.world.lanes[lane];
    return l.dir > 0 ? playerSpeed - l.speed : playerSpeed + l.speed;
  }

  /** difficulty 0..1 controls spacing. Returns array of events: {type:'passed', car, close, tight} */
  update(dt, playerSpeed, difficulty, playerLen, playerX) {
    const ev = this.events; ev.length = 0;
    const lanes = this.world.lanes;
    // move + recycle
    for (let i = this.active.length - 1; i >= 0; i--) {
      const c = this.active[i];
      c.z += c.relSpeed * dt;
      c.obj.position.z = c.z;
      const half = c.len / 2 + playerLen / 2;
      if (!c.scored && Math.abs(c.z) < half + 1.2) {
        const dx = Math.abs(c.x - playerX);
        if (dx < c.minDx) c.minDx = dx;
      }
      if (!c.scored && c.z > half + 1.2) {
        c.scored = true;
        if (!c.hit && c.minDx < CFG.closeCallX) ev.push({ type: 'close', car: c, tight: c.minDx < CFG.tightCallX });
        else ev.push({ type: 'passed', car: c });
      }
      if (c.z > CFG.despawnBehind + c.len) { this._release(c); this.active.splice(i, 1); }
    }
    // spawn per lane by spatial gap
    const base = 78 - 38 * difficulty;
    for (let li = 0; li < lanes.length; li++) {
      const st = this.laneState[li];
      const rel = this._relSpeed(li, playerSpeed);
      st.sinceSpawn += rel * dt;
      if (st.sinceSpawn < st.gap) continue;
      if (!this._canSpawn(li, rel, playerSpeed)) continue;
      this._spawn(li, rel);
      st.sinceSpawn = 0; st.gap = (base * (0.85 + Math.random() * 1.4)) / this.world.trafficDensity;
    }
    return ev;
  }

  // Never let all lanes be blocked around the same arrival time.
  _canSpawn(li, rel, playerSpeed) {
    const tNew = CFG.spawnDistance / rel;
    let blocked = 0;
    const seen = new Set();
    for (const c of this.active) {
      if (c.lane === li || seen.has(c.lane) || c.z > 10) continue;
      const t = -c.z / c.relSpeed;
      if (Math.abs(t - tNew) < 0.9 + 3.5 / playerSpeed * 10) { blocked++; seen.add(c.lane); }
    }
    return blocked < this.world.lanes.length - 1;
  }

  _spawn(li, rel) {
    // pick a free car of a random type
    let t = this._pick(), list = this.pools.get(t.id);
    if (!list.length) { t = TRAFFIC_TYPES[1]; list = this.pools.get(t.id); if (!list.length) return; }
    const c = list.pop();
    const lane = this.world.lanes[li];
    c.lane = li; c.x = laneX(this.world, li); c.z = -CFG.spawnDistance - c.len / 2; c.relSpeed = rel;
    c.minDx = 99; c.scored = false; c.hit = false;
    c.obj.position.set(c.x, 0, c.z);
    c.obj.rotation.y = lane.dir > 0 ? 0 : Math.PI;
    models.setVehicleColor(c.obj, TRAFFIC_COLORS[(Math.random() * TRAFFIC_COLORS.length) | 0]);
    c.obj.visible = true;
    this.active.push(c);
  }

  /** AABB test against the player. Returns the first overlapping car (with overlap info) or null. */
  collide(px, plen, pwid) {
    for (const c of this.active) {
      if (c.hit) continue;
      const ox = (c.wid + pwid) / 2 - Math.abs(c.x - px) - 0.12;
      if (ox <= 0) continue;
      const oz = (c.len + plen) / 2 - Math.abs(c.z) - 0.1;
      if (oz <= 0) continue;
      this.lastOverlapX = ox; this.lastOverlapZ = oz;
      return c;
    }
    return null;
  }

  dispose() { this.scene.remove(this.root); }
}
