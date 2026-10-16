// Falling pillar: a column beside the road that topples across it as the car approaches,
// blocking one side. Swerve to the open side.

import { Group, Mesh, CylinderGeometry, BoxGeometry, MeshLambertMaterial, MeshBasicMaterial } from 'three';
import { registerItem, NearMiss, carBox } from './registry.js';
import { trackMatrix } from '../render/trackMesh.js';

registerItem('pillar', {
  create(def, { s, path }) {
    const hw = path.widthAt(s) / 2;
    const side = Math.sign(def.side) || 1;
    const baseX = side * (hw + 1.6);
    def = { ...def, length: def.length ?? 1.6 + def.cover * hw * 2 };
    return {
      type: 'pillar',
      def,
      s,
      x: baseX,
      side,
      baseX,
      state: 'standing',
      fallT: 0,
      phi: 0, // 0 upright, PI/2 lying across the road
      reach: 120, // watch the car from far enough to trigger the fall in time
      miss: new NearMiss(def.near),
      update(dt) {
        if (this.state !== 'falling') return;
        this.fallT += dt;
        const k = Math.min(1, this.fallT / def.fallTime);
        this.phi = (Math.PI / 2) * k * k;
        if (k >= 1) this.state = 'down';
      },
      /** Points along the column in track coords (x, h). */
      points(phi = this.phi) {
        const out = [];
        for (let i = 0; i <= 8; i++) {
          const d = (i / 8) * def.length;
          out.push([baseX - side * d * Math.sin(phi), def.radius + d * Math.cos(phi)]);
        }
        return out;
      },
      collide(car, race) {
        const c = carBox(car);
        if (this.state === 'standing') {
          const tta = (this.s - c.s) / Math.max(5, car.speed);
          if (tta > 0 && tta < def.trigger) {
            this.state = 'falling';
            race.emit('pillar', {});
          }
        }
        const ds = Math.abs(c.s - this.s) - (c.hl + def.radius);
        if (ds > 0) {
          if (c.s > this.s && this.miss.passed()) race.nearMiss(this);
          return;
        }
        let best = Infinity;
        for (const [px, ph] of this.points()) {
          const dx = Math.max(0, Math.abs(px - c.x) - c.hw);
          const dh = Math.max(0, Math.abs(ph - (c.h + 0.7)) - 0.7);
          best = Math.min(best, Math.hypot(dx, dh));
        }
        if (best < def.radius) {
          this.miss.hit = true;
          race.hitCar(this, { slow: def.slow, push: -side * def.push });
        } else {
          this.miss.observe(best - def.radius);
        }
      },
      danger(x) {
        // Triggered before the car gets there, so plan for it lying across the road.
        const tip = baseX - side * def.length;
        const lo = Math.min(baseX, tip) - def.radius - 1.4;
        const hi = Math.max(baseX, tip) + def.radius + 1.4;
        return x > lo && x < hi ? 1 : 0;
      },
    };
  },

  view(items, { path }) {
    const group = new Group();
    const stone = new MeshLambertMaterial({ color: '#2a2440' });
    const neon = new MeshBasicMaterial({ color: '#ff2bd6' });
    const warn = new MeshBasicMaterial({ color: '#ff2b4a' });
    const geos = [];
    const g = (geo) => (geos.push(geo), geo);
    const entries = items.map((it) => {
      const d = it.def;
      const root = new Group();
      root.applyMatrix4(trackMatrix(path, it.s, 0, 0));
      const base = new Mesh(g(new BoxGeometry(d.radius * 3, 1, d.radius * 3)), stone);
      base.position.set(-it.baseX, 0.5, 0); // local +X is the driver's left
      root.add(base);
      const pivot = new Group();
      pivot.position.set(-it.baseX, 1, 0);
      root.add(pivot);
      const col = new Mesh(g(new CylinderGeometry(d.radius * 0.9, d.radius, d.length, 10)), stone);
      col.position.y = d.length / 2;
      pivot.add(col);
      for (const k of [0.25, 0.55, 0.85]) {
        const band = new Mesh(g(new CylinderGeometry(d.radius * 1.04, d.radius * 1.04, 0.25, 10)), neon);
        band.position.y = d.length * k;
        pivot.add(band);
      }
      const lamp = new Mesh(g(new BoxGeometry(0.7, 0.5, 0.7)), warn);
      lamp.position.y = d.length + 0.25;
      pivot.add(lamp);
      group.add(root);
      return { it, pivot, lamp };
    });
    return {
      objects: [group],
      update(dt, t) {
        for (const e of entries) {
          e.pivot.rotation.z = -e.it.side * e.it.phi; // falls towards the road (local +X is left)
          e.lamp.visible = e.it.state !== 'standing' || Math.floor(t * 4) % 2 === 0;
        }
      },
      dispose() {
        for (const o of [...geos, stone, neon, warn]) o.dispose();
      },
    };
  },
});
