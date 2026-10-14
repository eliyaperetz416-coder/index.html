import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { tintModel } from './tint.js';

const HAIR = '#7a4a2a';
const SKIN = '#f1d2b6';

function makeModel() {
  const hair = new THREE.Color(HAIR);
  const skin = new THREE.Color(SKIN);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Array(9).fill(0), 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute([...hair.toArray(), ...skin.toArray(), 0.1, 0.1, 0.1], 3));
  const root = new THREE.Group();
  const rig = new THREE.Group();
  rig.userData.palette = { hair: HAIR, skin: SKIN };
  rig.add(new THREE.Mesh(geo));
  root.add(rig);
  return root;
}

const colors = (model) => {
  let arr;
  model.traverse((o) => { if (o.isMesh) arr = Array.from(o.geometry.getAttribute('color').array); });
  return arr;
};

const expectColor = (actual, hex) => {
  new THREE.Color(hex).toArray().forEach((v, i) => expect(actual[i]).toBeCloseTo(v, 5));
};

describe('tintModel', () => {
  it('recolors only the hair of the tinted clone', () => {
    const base = makeModel();
    const a = base.clone(true);
    const b = base.clone(true);
    const before = colors(b);
    tintModel(a, { hair: '#ff0000' });
    const ca = colors(a);
    expectColor(ca.slice(0, 3), '#ff0000');
    expectColor(ca.slice(3, 6), SKIN);
    expect(ca.slice(6, 9)).toEqual(before.slice(6, 9));
    expect(colors(b)).toEqual(before);
  });

  it('recolors skin when asked', () => {
    const a = makeModel();
    tintModel(a, { skin: '#c08060' });
    expectColor(colors(a).slice(3, 6), '#c08060');
  });
});
