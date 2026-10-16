// Yellow boost pad: drive over it for a burst of speed.

import { InstancedMesh, PlaneGeometry, MeshBasicMaterial, AdditiveBlending, Matrix4, DoubleSide } from 'three';
import { registerItem } from './registry.js';
import { trackMatrix } from '../render/trackMesh.js';
import { chevronTexture } from '../render/textures.js';

registerItem('boost', {
  defaults: { length: 9, width: 5, power: 0.35, duration: 1.4 },

  create(def, { s }) {
    return {
      type: 'boost',
      def,
      s,
      x: def.x ?? 0,
      reach: def.length / 2 + 2,
      armed: true,
      collide(car, race) {
        if (car.mode !== 'ground') return;
        const inside = Math.abs(car.s - this.s) < this.def.length / 2 && Math.abs(car.x - this.x) < this.def.width / 2 + 0.6;
        if (inside && this.armed) {
          this.armed = false;
          race.boostPad(this);
        } else if (!inside && car.s > this.s + this.def.length) {
          this.armed = true;
        }
      },
    };
  },

  view(items, { path }) {
    const tex = chevronTexture('#ffd400', 'rgba(255,170,0,0.35)').clone();
    tex.needsUpdate = true;
    const geo = new PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: DoubleSide });
    const pads = new InstancedMesh(geo, mat, items.length);
    const glowMat = new MeshBasicMaterial({ color: '#ffb300', transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    const glow = new InstancedMesh(geo, glowMat, items.length);
    const m = new Matrix4();
    const sc = new Matrix4();
    items.forEach((it, i) => {
      trackMatrix(path, it.s, it.x, 0.05, m);
      pads.setMatrixAt(i, sc.makeScale(it.def.width, 1, it.def.length).premultiply(m));
      trackMatrix(path, it.s, it.x, 0.03, m);
      glow.setMatrixAt(i, sc.makeScale(it.def.width + 1.6, 1, it.def.length + 1.6).premultiply(m));
    });
    pads.renderOrder = 4;
    glow.renderOrder = 3;
    pads.computeBoundingSphere();
    glow.computeBoundingSphere();
    return {
      objects: [glow, pads],
      update(dt, t) {
        tex.offset.y = -t * 2.2;
        glowMat.opacity = 0.16 + 0.1 * Math.sin(t * 8);
      },
      dispose() {
        geo.dispose();
        mat.dispose();
        glowMat.dispose();
        tex.dispose();
      },
    };
  },
});
