// Sand trap (desert): deep sand drags the car down and dulls the steering while you are in it.

import { InstancedMesh, CircleGeometry, MeshLambertMaterial, Matrix4, DoubleSide } from 'three';
import { registerItem } from './registry.js';
import { trackMatrix } from '../render/trackMesh.js';
import { sandTexture } from '../render/textures.js';
import { rng } from '../core/math.js';

registerItem('sand', {
  create(def, { s }) {
    return {
      type: 'sand',
      def,
      s,
      x: def.x ?? 0,
      reach: def.length / 2 + 2,
      inside: false,
      collide(car, race, dt) {
        if (car.mode !== 'ground') return;
        const inside = Math.abs(car.s - this.s) < def.length / 2 && Math.abs(car.x - this.x) < def.width / 2 + 0.4;
        if (inside) {
          if (!this.inside) race.emit('sand', {});
          car.v *= 1 - def.drag * dt;
          car.oil(def.traction, 0.2);
          car.inSand = 0.15;
        }
        this.inside = inside;
      },
      danger(x) {
        return Math.abs(x - this.x) < def.width / 2 + 1.2 ? 0.6 : 0;
      },
    };
  },

  view(items, { path }) {
    const geo = new CircleGeometry(1, 24);
    const p = geo.attributes.position;
    const r = rng(13);
    for (let i = 1; i < p.count; i++) {
      const k = 0.8 + r() * 0.25;
      p.setXY(i, p.getX(i) * k, p.getY(i) * k);
    }
    geo.rotateX(-Math.PI / 2);
    const tex = sandTexture('#e2a868').clone();
    tex.repeat.set(3, 3);
    tex.needsUpdate = true;
    const mat = new MeshLambertMaterial({ map: tex, side: DoubleSide });
    const mesh = new InstancedMesh(geo, mat, items.length);
    const m = new Matrix4();
    const sc = new Matrix4();
    items.forEach((it, i) => {
      trackMatrix(path, it.s, it.x, 0.04, m);
      mesh.setMatrixAt(i, sc.makeScale(it.def.width / 2, 1, it.def.length / 2).premultiply(m));
    });
    mesh.renderOrder = 2;
    mesh.computeBoundingSphere();
    return {
      objects: [mesh],
      dispose() {
        geo.dispose();
        mat.dispose();
        tex.dispose();
      },
    };
  },
});
