// Spinning sawblade standing in a slot in the road, facing the driver, sliding side to side.

import {
  InstancedMesh, CylinderGeometry, BoxGeometry, MeshStandardMaterial, MeshLambertMaterial, MeshBasicMaterial,
  AdditiveBlending, Matrix4, Quaternion, Vector3, TorusGeometry, DoubleSide, PlaneGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerItem, NearMiss, carBox } from './registry.js';
import { trackMatrix } from '../render/trackMesh.js';

const TAU = Math.PI * 2;

registerItem('sawblade', {
  create(def, { s }) {
    const x0 = def.x ?? 0;
    const xAt = (t) => x0 + def.sweep * Math.sin((TAU * t) / def.period + def.phase);
    return {
      type: 'sawblade',
      def,
      s,
      x: x0,
      bx: xAt(0),
      angle: 0,
      reach: 6,
      miss: new NearMiss(def.near),
      xAt,
      update(dt, t) {
        this.bx = xAt(t);
        this.angle += def.spin * dt;
      },
      collide(car, race) {
        const c = carBox(car);
        const r = def.radius;
        const ds = Math.abs(c.s - this.s) - (c.hl + 0.2);
        if (ds > 0) {
          if (c.s > this.s && this.miss.passed()) race.nearMiss(this);
          return;
        }
        if (c.h > r * 1.45) return; // flying over it
        const dx = Math.abs(c.x - this.bx) - (c.hw + r * 0.9);
        if (dx < 0) {
          this.miss.hit = true;
          race.hitCar(this, { slow: def.slow, push: Math.sign(c.x - this.bx || 1) * def.push });
        } else {
          this.miss.observe(dx);
        }
      },
      /** For AI: would a car at lateral x be hit when it reaches the blade at time t? */
      danger(x, t) {
        const bx = xAt(t);
        return Math.abs(x - bx) < def.radius + 1.6 ? 1 : 0;
      },
    };
  },

  view(items, { path, quality }) {
    // Blade: chrome disc, glowing red teeth, hub ring. Axis along the track so it faces the driver.
    const r = items[0].def.radius;
    const blade = new CylinderGeometry(r * 0.92, r * 0.92, 0.12, 28);
    blade.rotateX(Math.PI / 2);
    const teethParts = [];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      const tooth = new BoxGeometry(0.55, 0.14, 0.55);
      tooth.rotateY(Math.PI / 4);
      tooth.scale(1, 1, 0.7);
      tooth.rotateY(-a);
      tooth.translate(Math.cos(a) * r * 0.95, 0, Math.sin(a) * r * 0.95);
      teethParts.push(tooth);
    }
    teethParts.push(new TorusGeometry(r * 0.3, 0.1, 6, 18).rotateX(Math.PI / 2));
    const teeth = mergeGeometries(teethParts);
    teeth.rotateX(Math.PI / 2);
    teethParts.forEach((p) => p.dispose());
    const bladeMat = quality.standardMaterials
      ? new MeshStandardMaterial({ color: '#eef1f8', metalness: 0.75, roughness: 0.18, emissive: '#2a0010' })
      : new MeshLambertMaterial({ color: '#d9dce6', emissive: '#2a0010' });
    const ring = teeth;
    const ringMat = new MeshBasicMaterial({ color: '#ff2b4a' });
    const slot = new PlaneGeometry(1, 1);
    slot.rotateX(-Math.PI / 2);
    const slotMat = new MeshBasicMaterial({ color: '#ff2b4a', transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    const n = items.length;
    const blades = new InstancedMesh(blade, bladeMat, n);
    const rings = new InstancedMesh(ring, ringMat, n);
    const slots = new InstancedMesh(slot, slotMat, n);
    blades.frustumCulled = rings.frustumCulled = false;
    const base = items.map((it) => {
      const m = trackMatrix(path, it.s, 0, 0);
      const q = new Quaternion().setFromRotationMatrix(m);
      const f = path.sampleAt(it.s);
      return { q, pos: f.pos.clone(), R: f.R.clone(), U: f.U.clone(), T: f.T.clone() };
    });
    const m = new Matrix4();
    const sc = new Matrix4();
    items.forEach((it, i) => {
      const width = it.def.sweep * 2 + it.def.radius * 2 + 1;
      trackMatrix(path, it.s, it.def.x ?? 0, 0.04, m);
      slots.setMatrixAt(i, sc.makeScale(width, 1, 0.5).premultiply(m));
    });
    const p = new Vector3();
    const spin = new Quaternion();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    const zAxis = new Vector3(0, 0, 1);
    return {
      objects: [slots, blades, rings],
      update() {
        items.forEach((it, i) => {
          const b = base[i];
          p.copy(b.pos).addScaledVector(b.R, it.bx).addScaledVector(b.U, it.def.radius * 0.45);
          spin.setFromAxisAngle(zAxis, it.angle);
          q.copy(b.q).multiply(spin);
          m.compose(p, q, one);
          blades.setMatrixAt(i, m);
          rings.setMatrixAt(i, m);
        });
        blades.instanceMatrix.needsUpdate = true;
        rings.instanceMatrix.needsUpdate = true;
      },
      dispose() {
        for (const o of [blade, bladeMat, teeth, ringMat, slot, slotMat]) o.dispose();
      },
    };
  },
});
