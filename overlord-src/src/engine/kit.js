// A small modelling kit: add boxes, cylinders and other shapes one by one, then
// bake everything into one mesh per material. Models stay cheap to draw, and every
// surface gets textures at the same real-world scale (1 texture tile = TILE metres).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TILE = 2.4;
const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v3 = new THREE.Vector3();

/** Give a geometry "box mapped" texture coordinates from its real position. */
function boxMap(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = pos.getX(i); v = pos.getZ(i); }
    else if (ax >= az) { u = pos.getZ(i); v = pos.getY(i); }
    else { u = pos.getX(i); v = pos.getY(i); }
    uv[i * 2] = u / TILE;
    uv[i * 2 + 1] = v / TILE;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export class Kit {
  constructor() {
    this.parts = new Map(); // material → list of geometries
  }

  /** Add any geometry. `at` = [x, y, z], `rot` = [rx, ry, rz] in radians, `keepUV` for painted textures. */
  add(material, geometry, at = [0, 0, 0], rot = [0, 0, 0], keepUV = false) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.applyMatrix4(m4.compose(v3.set(...at), quat.setFromEuler(euler.set(...rot)), one));
    if (!keepUV) boxMap(g);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(g);
    return this;
  }

  box(material, w, h, d, at, rot) {
    return this.add(material, new THREE.BoxGeometry(w, h, d), at, rot);
  }

  /** Upright cylinder (or cone, if the radii differ). */
  cyl(material, rTop, rBottom, h, at, rot, segments = 16) {
    return this.add(material, new THREE.CylinderGeometry(rTop, rBottom, h, segments), at, rot);
  }

  ball(material, r, at, scale = [1, 1, 1]) {
    return this.add(material, new THREE.SphereGeometry(r, 20, 14).scale(...scale), at);
  }

  /** A straight pipe or beam between two points. */
  beam(material, from, to, r = 0.05, segments = 8) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const geo = new THREE.CylinderGeometry(r, r, a.distanceTo(b), segments);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const g = geo.toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().compose(a.add(b).multiplyScalar(0.5), q, one));
    return this.add(material, g);
  }

  /** Copy everything from another kit, moved and turned. */
  merge(other, at = [0, 0, 0], ry = 0) {
    m4.compose(v3.set(...at), quat.setFromEuler(euler.set(0, ry, 0)), one);
    for (const [material, list] of other.parts) {
      if (!this.parts.has(material)) this.parts.set(material, []);
      for (const g of list) this.parts.get(material).push(g.clone().applyMatrix4(m4));
    }
    return this;
  }

  /** Bake into a Group: one mesh per material. */
  build({ shadows = true } = {}) {
    const group = new THREE.Group();
    for (const [material, list] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(list), material);
      mesh.castShadow = shadows && !material.transparent;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}
