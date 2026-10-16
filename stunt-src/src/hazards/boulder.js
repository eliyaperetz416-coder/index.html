// Rolling boulder (desert): sits up the track and rolls down towards you when you get close.
// Stay out of its lane.

import { InstancedMesh, IcosahedronGeometry, MeshLambertMaterial, Matrix4, Quaternion, Vector3 } from 'three';
import { registerItem, NearMiss, carBox } from './registry.js';
import { rng } from '../core/math.js';

registerItem('boulder', {
  create(def, { s }) {
    return {
      type: 'boulder',
      def,
      s0: s, // where it waits
      s, // where it is now (rolls back towards the car)
      x: def.x ?? 0,
      bs: s,
      roll: 0,
      state: 'waiting', // rolling, gone
      t0: 0,
      reach: 160,
      miss: new NearMiss(def.near),
      update(dt) {
        if (this.state !== 'rolling') return;
        this.t0 += dt;
        this.bs -= def.speed * dt;
        this.s = this.bs;
        this.roll += (def.speed / def.radius) * dt;
        if (this.t0 > 6) this.state = 'gone';
      },
      collide(car, race) {
        const c = carBox(car);
        if (this.state === 'waiting') {
          // Closing speed: car forwards plus boulder backwards.
          const tta = (this.s0 - c.s) / Math.max(5, car.speed + def.speed);
          if (tta > 0 && tta < def.trigger) {
            this.state = 'rolling';
            race.emit('boulder', {});
          }
          return;
        }
        if (this.state !== 'rolling') return;
        const ds = Math.abs(c.s - this.bs) - c.hl;
        if (ds > def.radius) {
          if (c.s > this.bs && this.miss.passed()) race.nearMiss(this);
          return;
        }
        const dx = Math.max(0, Math.abs(c.x - this.x) - c.hw);
        const dh = Math.max(0, Math.abs(def.radius - (c.h + 0.7)) - 0.7);
        const d = Math.hypot(dx, dh, Math.max(0, ds));
        if (d < def.radius) {
          this.miss.hit = true;
          this.state = 'gone';
          race.hitCar(this, { slow: def.slow, push: Math.sign(c.x - this.x || 1) * def.push, pop: def.pop, spin: def.spin });
        } else {
          this.miss.observe(d - def.radius);
        }
      },
      danger(x) {
        return this.state !== 'gone' && Math.abs(x - this.x) < def.radius + 1.8 ? 1 : 0;
      },
    };
  },

  view(items, { path, world }) {
    const geo = new IcosahedronGeometry(1, 1);
    // Lumpy rock.
    const p = geo.attributes.position;
    const r = rng(9);
    for (let i = 0; i < p.count; i++) {
      const k = 0.85 + r() * 0.25;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const mat = new MeshLambertMaterial({ color: world?.hazardStyle?.stone ?? '#8a6a50', flatShading: true });
    const mesh = new InstancedMesh(geo, mat, items.length);
    mesh.frustumCulled = false;
    const m = new Matrix4();
    const q = new Quaternion();
    const spin = new Quaternion();
    const pos = new Vector3();
    const scale = new Vector3();
    const left = new Vector3();
    const basis = new Matrix4();
    const update = () => {
      items.forEach((it, i) => {
        if (it.state === 'gone' && it.t0 > 0) {
          mesh.setMatrixAt(i, m.makeScale(0, 0, 0));
          return;
        }
        const f = path.sampleAt(Math.max(0, it.bs));
        pos.copy(f.pos).addScaledVector(f.R, it.x).addScaledVector(f.U, it.def.radius);
        left.copy(f.R).negate();
        q.setFromRotationMatrix(basis.makeBasis(left, f.U, f.T));
        // Rolling towards -T: spin about the local left axis.
        spin.setFromAxisAngle(new Vector3(1, 0, 0), -it.roll);
        q.multiply(spin);
        mesh.setMatrixAt(i, m.compose(pos, q, scale.setScalar(it.def.radius)));
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    update();
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
