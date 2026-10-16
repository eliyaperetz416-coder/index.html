// Wrecking ball swinging across the road under a gantry. A hit throws the car into the air
// spinning; it lands (or crashes) and keeps going.

import { Group, Mesh, SphereGeometry, CylinderGeometry, BoxGeometry, TorusGeometry, MeshStandardMaterial, MeshLambertMaterial, MeshBasicMaterial } from 'three';
import { registerItem, NearMiss, carBox } from './registry.js';
import { trackMatrix } from '../render/trackMesh.js';
import { DEG } from '../core/math.js';

const TAU = Math.PI * 2;

registerItem('wreckingBall', {
  create(def, { s }) {
    const x0 = def.x ?? 0;
    const amp = def.swing * DEG;
    const angleAt = (t) => amp * Math.sin((TAU * t) / def.period + def.phase);
    const ballAt = (t) => {
      const a = angleAt(t);
      return { x: x0 + def.chain * Math.sin(a), h: def.pivotHeight - def.chain * Math.cos(a) };
    };
    return {
      type: 'wreckingBall',
      def,
      s,
      x: x0,
      angle: 0,
      ball: ballAt(0),
      reach: 6,
      miss: new NearMiss(def.near),
      angleAt,
      ballAt,
      update(dt, t) {
        this.angle = angleAt(t);
        this.ball = ballAt(t);
        this.swingDir = Math.sign(angleAt(t + 0.01) - this.angle) || 1;
      },
      collide(car, race) {
        const c = carBox(car);
        const r = def.radius;
        const ds = Math.abs(c.s - this.s) - c.hl;
        if (ds > r) {
          if (c.s > this.s && this.miss.passed()) race.nearMiss(this);
          return;
        }
        // Distance from ball centre to the car box (in the track's x/h plane, plus along s).
        const dx = Math.max(0, Math.abs(this.ball.x - c.x) - c.hw);
        const dh = Math.max(0, Math.abs(this.ball.h - (c.h + 0.7)) - 0.7);
        const d = Math.hypot(dx, dh, Math.max(0, ds));
        if (d < r) {
          this.miss.hit = true;
          race.hitCar(this, { slow: def.slow, push: this.swingDir * def.push, pop: def.pop, spin: def.spin });
        } else {
          this.miss.observe(d - r);
        }
      },
      danger(x, t) {
        for (const dt of [-0.15, 0, 0.15]) {
          const b = ballAt(t + dt);
          if (b.h - def.radius < 1.6 && Math.abs(x - b.x) < def.radius + 1.8) return 1;
        }
        return 0;
      },
    };
  },

  view(items, { path, quality, world }) {
    const group = new Group();
    const std = quality.standardMaterials;
    const metal = std ? new MeshStandardMaterial({ color: '#2a2833', metalness: 0.9, roughness: 0.35 }) : new MeshLambertMaterial({ color: '#2a2833' });
    const frame = new MeshLambertMaterial({ color: '#1b1430' });
    const glow = new MeshBasicMaterial({ color: world?.hazardStyle?.accent ?? '#ff2b4a' });
    const chainMat = new MeshLambertMaterial({ color: '#8d8a99' });
    const geos = [];
    const g = (geo) => (geos.push(geo), geo);
    const entries = items.map((it) => {
      const d = it.def;
      const hw = path.widthAt(it.s) / 2;
      const root = new Group();
      root.applyMatrix4(trackMatrix(path, it.s, it.x, 0));
      // Gantry.
      for (const side of [-1, 1]) {
        const post = new Mesh(g(new BoxGeometry(0.9, d.pivotHeight + 1, 0.9)), frame);
        post.position.set(side * (hw + 1.4), (d.pivotHeight + 1) / 2, 0);
        root.add(post);
      }
      const beam = new Mesh(g(new BoxGeometry(hw * 2 + 3.7, 0.9, 0.9)), frame);
      beam.position.set(0, d.pivotHeight + 0.6, 0);
      root.add(beam);
      const stripe = new Mesh(g(new BoxGeometry(hw * 2 + 3.7, 0.2, 0.95)), glow);
      stripe.position.set(0, d.pivotHeight + 0.2, 0);
      root.add(stripe);
      // Pendulum: swings about the track direction (local Z).
      const pivot = new Group();
      pivot.position.set(0, d.pivotHeight, 0);
      root.add(pivot);
      const chain = new Mesh(g(new CylinderGeometry(0.12, 0.12, d.chain, 6)), chainMat);
      chain.position.y = -d.chain / 2;
      pivot.add(chain);
      const ball = new Mesh(g(new SphereGeometry(d.radius, 20, 14)), metal);
      ball.position.y = -d.chain;
      pivot.add(ball);
      const band = new Mesh(g(new TorusGeometry(d.radius * 1.01, 0.14, 6, 24)), glow);
      band.position.y = -d.chain;
      band.rotation.x = Math.PI / 2;
      pivot.add(band);
      group.add(root);
      return { it, pivot };
    });
    return {
      objects: [group],
      update() {
        // Local +X is the driver's left, so a swing towards +x (right) is a negative angle.
        for (const e of entries) e.pivot.rotation.z = -e.it.angle;
      },
      dispose() {
        for (const o of [...geos, metal, frame, glow, chainMat]) o.dispose();
      },
    };
  },
});

