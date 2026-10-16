// Laser gate: the road is split into lanes; each lane's beams switch on and off in a pattern.
// Pick the dark lane. Beams flicker as a warning just before they switch on.

import { Group, Mesh, BoxGeometry, InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, AdditiveBlending, Matrix4, Color } from 'three';
import { registerItem, carBox } from './registry.js';
import { trackMatrix } from '../render/trackMesh.js';

const BEAM_HEIGHTS = [0.35, 0.8, 1.25];

registerItem('laser', {
  create(def, { s, path }) {
    const hw = path.widthAt(s) / 2;
    const lanes = def.lanes;
    const laneW = (hw * 2) / lanes;
    const phaseOf = (i) => {
      if (def.pattern === 'sync') return 0;
      if (def.pattern === 'wave') return i / lanes;
      return (i % 2) * 0.5; // alternate
    };
    /** Seconds into the cycle of lane i at time t, as a 0..1 fraction. */
    const frac = (i, t) => {
      const f = t / def.period + def.phase + phaseOf(i);
      return f - Math.floor(f);
    };
    const on = (i, t) => frac(i, t) < def.duty;
    const lanesUnder = (x0, x1) => {
      const out = [];
      for (let i = 0; i < lanes; i++) {
        const a = -hw + i * laneW;
        if (x1 > a && x0 < a + laneW) out.push(i);
      }
      return out;
    };
    return {
      type: 'laser',
      def,
      s,
      x: 0,
      hw,
      lanes,
      laneW,
      reach: 5,
      time: 0,
      passed: false,
      on,
      frac,
      update(dt, t) {
        this.time = t;
      },
      collide(car, race) {
        const c = carBox(car);
        const inside = Math.abs(c.s - this.s) < c.hl;
        if (!inside) {
          if (c.s < this.s) this.passed = false;
          return;
        }
        if (this.passed || c.h > 1.5) return;
        this.passed = true;
        const t = this.time;
        const under = lanesUnder(c.x - c.hw, c.x + c.hw);
        if (under.some((i) => on(i, t))) {
          race.hitCar(this, { slow: def.slow, push: 0 });
          return;
        }
        // Slipped through a lane that switches on (or just switched off) within `near` seconds.
        const close = under.some((i) => on(i, t + def.near) || on(i, t - def.near));
        if (close) race.nearMiss(this);
      },
      danger(x, t) {
        const under = lanesUnder(x - 1.3, x + 1.3);
        for (const dt of [-0.2, 0, 0.2]) if (under.some((i) => on(i, t + dt))) return 1;
        return 0;
      },
    };
  },

  view(items, { path }) {
    const group = new Group();
    const post = new BoxGeometry(0.6, 2.2, 0.6);
    const top = new BoxGeometry(1, 0.35, 0.5);
    const frameMat = new MeshLambertMaterial({ color: '#1b1430' });
    const capMat = new MeshBasicMaterial({ color: '#ff2b4a' });
    const beamGeo = new BoxGeometry(1, 0.09, 0.09);
    const beamMat = new MeshBasicMaterial({ color: '#ffffff', blending: AdditiveBlending, transparent: true, depthWrite: false });
    const glowGeo = new BoxGeometry(1, 0.45, 0.45);
    const total = items.reduce((a, it) => a + it.lanes * BEAM_HEIGHTS.length, 0);
    const beams = new InstancedMesh(beamGeo, beamMat, total);
    const glows = new InstancedMesh(glowGeo, beamMat, total);
    beams.renderOrder = glows.renderOrder = 6;
    const m = new Matrix4();
    const sc = new Matrix4();
    const slots = [];
    items.forEach((it) => {
      const root = new Group();
      root.applyMatrix4(trackMatrix(path, it.s, 0, 0));
      for (const side of [-1, 1]) {
        const p = new Mesh(post, frameMat);
        p.position.set(side * (it.hw + 0.5), 1.1, 0);
        root.add(p);
        const cap = new Mesh(top, capMat);
        cap.position.set(side * (it.hw + 0.5), 2.3, 0);
        root.add(cap);
      }
      group.add(root);
      for (let lane = 0; lane < it.lanes; lane++) {
        for (const h of BEAM_HEIGHTS) {
          // Lane centre in local coordinates (local +X is the driver's left).
          const x = -(-it.hw + (lane + 0.5) * it.laneW);
          trackMatrix(path, it.s, 0, 0, m);
          const local = new Matrix4().makeTranslation(x, h, 0).multiply(sc.makeScale(it.laneW - 0.15, 1, 1));
          const world = m.clone().multiply(local);
          beams.setMatrixAt(slots.length, world);
          glows.setMatrixAt(slots.length, world);
          slots.push({ it, lane });
        }
      }
    });
    beams.computeBoundingSphere();
    glows.computeBoundingSphere();
    const hot = new Color('#ff3355');
    const glowC = new Color('#ff1840');
    const c = new Color();
    const update = (dt, t) => {
      slots.forEach((sl, i) => {
        const { it, lane } = sl;
        let k;
        if (it.on(lane, t)) k = 1;
        else {
          // Warning flicker shortly before switching on.
          const f = it.frac(lane, t + it.def.warn);
          k = f < it.def.duty ? (Math.floor(t * 30) % 2 ? 0.45 : 0.05) : 0.04;
        }
        beams.setColorAt(i, c.copy(hot).multiplyScalar(k * 1.6));
        glows.setColorAt(i, c.copy(glowC).multiplyScalar(k * 0.35));
      });
      beams.instanceColor.needsUpdate = true;
      glows.instanceColor.needsUpdate = true;
    };
    update(0, 0);
    return {
      objects: [group, glows, beams],
      update,
      dispose() {
        for (const o of [post, top, frameMat, capMat, beamGeo, beamMat, glowGeo]) o.dispose();
      },
    };
  },
});
