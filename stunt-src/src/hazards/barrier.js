// Barrier block: a static obstacle. Hitting it costs speed and knocks it away; squeezing past it
// counts as a near miss.

import { Mesh, BoxGeometry, MeshLambertMaterial, MeshBasicMaterial, Group, Vector3, Quaternion } from 'three';
import { registerItem, NearMiss, carBox } from './registry.js';
import { trackMatrix } from '../render/trackMesh.js';
import { stripeTexture } from '../render/textures.js';

registerItem('barrier', {
  create(def, { s }) {
    return {
      type: 'barrier',
      def,
      s,
      x: def.x ?? 0,
      reach: 8,
      knocked: false,
      knockT: 0,
      knockDir: 1,
      miss: new NearMiss(def.near),
      update(dt) {
        if (this.knocked) this.knockT += dt;
      },
      danger(x) {
        return !this.knocked && Math.abs(x - this.x) < this.def.width / 2 + 1.4 ? 1 : 0;
      },
      collide(car, race) {
        if (this.knocked) return;
        const c = carBox(car);
        const ds = Math.abs(c.s - this.s) - (c.hl + this.def.length / 2);
        const dx = Math.abs(c.x - this.x) - (c.hw + this.def.width / 2);
        const dh = c.h - this.def.height;
        if (ds < 0 && dx < 0 && dh < 0) {
          this.knocked = true;
          this.miss.hit = true;
          this.knockDir = Math.sign(c.x - this.x) || 1;
          race.hitCar(this, { slow: this.def.slow, push: this.knockDir * 5 });
          return;
        }
        // Near miss: alongside it with little side clearance.
        if (ds < 0 && dh < 0) this.miss.observe(dx);
        if (c.s > this.s + c.hl + 1 && this.miss.passed()) race.nearMiss(this);
      },
    };
  },

  view(items, { path }) {
    const geo = new BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new MeshLambertMaterial({ map: stripeTexture('#ff2b4a', '#16111f') });
    const lampGeo = new BoxGeometry(0.3, 0.3, 0.3);
    const lampMat = new MeshBasicMaterial({ color: '#ff3355' });
    const group = new Group();
    const entries = items.map((it) => {
      const g = new Group();
      const block = new Mesh(geo, mat);
      block.scale.set(it.def.width, it.def.height, it.def.length);
      g.add(block);
      for (const side of [-1, 1]) {
        const lamp = new Mesh(lampGeo, lampMat);
        lamp.position.set(side * (it.def.width / 2 - 0.2), it.def.height + 0.15, 0);
        g.add(lamp);
      }
      g.applyMatrix4(trackMatrix(path, it.s, it.x, 0));
      group.add(g);
      return { it, g, pos: g.position.clone(), q: g.quaternion.clone(), up: path.sampleAt(it.s).U.clone(), right: path.sampleAt(it.s).R.clone() };
    });
    const spin = new Quaternion();
    const axis = new Vector3();
    return {
      objects: [group],
      update(dt, t) {
        lampMat.color.setHSL(0.98, 1, 0.45 + 0.2 * Math.sin(t * 10));
        for (const e of entries) {
          const k = e.it.knockT;
          if (!e.it.knocked) continue;
          if (k > 1.2) {
            e.g.visible = false;
            continue;
          }
          // Tumbles away off the road.
          e.g.position.copy(e.pos).addScaledVector(e.right, -e.it.knockDir * k * 14).addScaledVector(e.up, k * 9 - k * k * 9);
          axis.copy(e.right).applyAxisAngle(e.up, 0.7).normalize();
          spin.setFromAxisAngle(axis, k * 9);
          e.g.quaternion.copy(spin).multiply(e.q);
        }
      },
      dispose() {
        geo.dispose();
        mat.dispose();
        lampGeo.dispose();
        lampMat.dispose();
      },
    };
  },
});
