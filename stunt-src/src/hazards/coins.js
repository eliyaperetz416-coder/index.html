// Coin pickups: a row of coins along the road (or in an arc over a jump).
// def: { count, spacing, pattern: 'line' | 'zigzag' | 'arc', x, height (arc peak), value }

import { InstancedMesh, CylinderGeometry, MeshStandardMaterial, MeshLambertMaterial, Matrix4, Quaternion, Vector3 } from 'three';
import { registerItem } from './registry.js';

registerItem('coins', {
  create(def, { s }) {
    const coins = [];
    const n = def.count;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5;
      let x = def.x ?? 0;
      let h = 1.1;
      if (def.pattern === 'zigzag') x += Math.sin(i * 0.9) * def.amp;
      if (def.pattern === 'arc') h += Math.sin(Math.PI * t) * def.height;
      coins.push({ s: s + i * def.spacing, x, h, taken: false });
    }
    const len = (n - 1) * def.spacing;
    return {
      type: 'coins',
      def,
      coins,
      s: s + len / 2,
      x: def.x ?? 0,
      reach: len / 2 + 3,
      danger(x) {
        const left = this.coins.filter((c) => !c.taken && c.h < 3);
        return left.some((c) => Math.abs(x - c.x) < 1.5) ? -0.25 : 0;
      },
      collide(car, race) {
        const cs = car.trackS;
        const cx = car.proj.x;
        const ch = car.mode === 'ground' ? 0.6 : car.proj.h + 0.6;
        for (const c of this.coins) {
          if (c.taken) continue;
          if (Math.abs(cs - c.s) < 2.4 && Math.abs(cx - c.x) < 1.9 && Math.abs(ch - c.h) < 2.2) {
            c.taken = true;
            race.collectCoin(c, this.def.value);
          }
        }
      },
    };
  },

  view(items, { path, quality }) {
    const all = items.flatMap((it) => it.coins);
    const geo = new CylinderGeometry(0.6, 0.6, 0.12, 18);
    geo.rotateX(Math.PI / 2); // face along the track
    const mat = quality.standardMaterials
      ? new MeshStandardMaterial({ color: '#ffe04a', metalness: 0.45, roughness: 0.3, emissive: '#ffb000', emissiveIntensity: 0.9 })
      : new MeshLambertMaterial({ color: '#ffe04a', emissive: '#ffb000', emissiveIntensity: 0.9 });
    const mesh = new InstancedMesh(geo, mat, Math.max(1, all.length));
    const base = all.map((c) => {
      const f = path.sampleAt(c.s);
      const pos = f.pos.clone().addScaledVector(f.R, c.x).addScaledVector(f.U, c.h);
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(f.R.clone().negate(), f.U, f.T));
      return { pos, q, up: f.U.clone() };
    });
    const m = new Matrix4();
    const spin = new Quaternion();
    const q = new Quaternion();
    const zero = new Vector3(0, 0, 0);
    const one = new Vector3(1, 1, 1);
    const pop = new Map(); // coin -> seconds since taken
    const tmp = new Vector3();
    const shrink = new Vector3();
    mesh.frustumCulled = false;
    const update = (dt, t) => {
      all.forEach((c, i) => {
        const b = base[i];
        if (c.taken) {
          let a = (pop.get(c) ?? 0) + dt;
          pop.set(c, a);
          if (a > 0.3) {
            m.compose(b.pos, b.q, zero);
          } else {
            // Quick fly-up and shrink when collected.
            tmp.copy(b.pos).addScaledVector(b.up, a * 8);
            m.compose(tmp, b.q, shrink.setScalar(1 - a / 0.3 + 0.01));
          }
        } else {
          spin.setFromAxisAngle(b.up, t * 3 + i * 0.4);
          q.copy(spin).multiply(b.q);
          m.compose(b.pos, q, one);
        }
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    update(0, 0);
    return {
      objects: [mesh],
      update,
      dispose() {
        geo.dispose();
        mat.dispose();
      },
    };
  },
});
