// Oil slick: grip almost disappears while you are on it (and for a moment after). The car keeps
// sliding the way it was going.

import { InstancedMesh, CircleGeometry, MeshBasicMaterial, Matrix4, DoubleSide } from 'three';
import { registerItem } from './registry.js';
import { trackMatrix } from '../render/trackMesh.js';
import { oilTexture } from '../render/textures.js';
import { rng } from '../core/math.js';

registerItem('oil', {
  create(def, { s }) {
    return {
      type: 'oil',
      def,
      s,
      x: def.x ?? 0,
      reach: def.length / 2 + 2,
      inside: false,
      collide(car, race) {
        if (car.mode !== 'ground') return;
        const inside = Math.abs(car.s - this.s) < def.length / 2 && Math.abs(car.x - this.x) < def.width / 2 + 0.4;
        if (inside) {
          if (!this.inside) {
            // A random little kick sideways as the tyres let go.
            car.vx += (Math.random() < 0.5 ? -1 : 1) * 2.5;
            race.emit('oil', {});
          }
          car.oil(def.traction, def.linger);
        }
        this.inside = inside;
      },
      danger(x) {
        return Math.abs(x - this.x) < def.width / 2 + 1.2 ? 0.5 : 0;
      },
    };
  },

  view(items, { path }) {
    // Blobby outline: a circle with a wobbly radius.
    const geo = new CircleGeometry(1, 28);
    const p = geo.attributes.position;
    const r = rng(5);
    for (let i = 1; i < p.count; i++) {
      const k = 0.78 + r() * 0.3;
      p.setXY(i, p.getX(i) * k, p.getY(i) * k);
    }
    geo.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ map: oilTexture(), transparent: true, depthWrite: false, side: DoubleSide });
    const mesh = new InstancedMesh(geo, mat, items.length);
    const m = new Matrix4();
    const sc = new Matrix4();
    items.forEach((it, i) => {
      trackMatrix(path, it.s, it.x, 0.035, m);
      mesh.setMatrixAt(i, sc.makeScale(it.def.width / 2, 1, it.def.length / 2).premultiply(m));
    });
    mesh.renderOrder = 2;
    mesh.computeBoundingSphere();
    return {
      objects: [mesh],
      dispose() {
        geo.dispose();
        mat.dispose();
      },
    };
  },
});
