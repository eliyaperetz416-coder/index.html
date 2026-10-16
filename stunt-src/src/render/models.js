// Model layer. Gameplay code asks for models by kind ("car", "hazard:sawblade", ...) and gets an
// Object3D. Today every model is built from simple geometry; to use a real 3D model later, give
// the config object a `model: 'models/thing.glb'` URL (and optional `modelScale`, `modelRotation`)
// and it is loaded with GLTFLoader and swapped in for the placeholder when ready.

import {
  Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, MeshStandardMaterial,
  MeshLambertMaterial, MeshBasicMaterial, AdditiveBlending, Color, DoubleSide, TorusGeometry,
} from 'three';
import { blobTexture } from './textures.js';

const builders = new Map();
const gltfCache = new Map();
let loaderPromise = null;

/** Register a procedural builder: fn(def, opts) => Object3D (may set userData.parts). */
export function registerModel(kind, fn) {
  builders.set(kind, fn);
}

/**
 * @param {string} kind
 * @param {object} def config object (car, hazard, ...)
 * @param {object} opts builder options (cosmetics, quality, ...)
 */
export function createModel(kind, def, opts = {}) {
  const root = new Group();
  root.name = `${kind}:${def?.id ?? ''}`;
  const build = builders.get(kind);
  const inner = build ? build(def, opts) : new Group();
  root.add(inner);
  root.userData.parts = inner.userData.parts ?? {};
  if (def?.model) {
    loadGltf(def.model)
      .then((scene) => {
        if (root.userData.disposed) return;
        const m = scene.clone(true);
        if (def.modelScale) m.scale.setScalar(def.modelScale);
        if (def.modelRotation) m.rotation.set(...def.modelRotation);
        disposeObject(inner);
        root.remove(inner);
        root.add(m);
        root.userData.parts = { wheels: findWheels(m) };
      })
      .catch((e) => console.warn(`model ${def.model} failed, keeping the placeholder`, e));
  }
  return root;
}

function loadGltf(url) {
  if (!gltfCache.has(url)) {
    loaderPromise ??= import('three/addons/loaders/GLTFLoader.js').then((m) => new m.GLTFLoader());
    gltfCache.set(url, loaderPromise.then((loader) => loader.loadAsync(url)).then((g) => g.scene));
  }
  return gltfCache.get(url);
}

function findWheels(obj) {
  const out = [];
  obj.traverse((o) => /wheel/i.test(o.name) && out.push(o));
  return out;
}

/** Free GPU memory of everything under obj (geometries, materials, unless marked shared). */
export function disposeObject(obj) {
  obj.userData.disposed = true;
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (!m.userData.shared) m.dispose();
  });
}

// ---------------------------------------------------------------------------------------------
// Cars

/** Box whose top face is shrunk/shifted: a simple cabin or nose shape. */
function taperedBox(w, h, l, { topW = 1, topL = 1, shiftZ = 0 } = {}) {
  const g = new BoxGeometry(w, h, l);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * topW);
      p.setZ(i, p.getZ(i) * topL + shiftZ);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function paintMaterial(paint, quality) {
  const color = new Color(paint.color);
  if (quality?.standardMaterials === false) {
    return new MeshLambertMaterial({ color, emissive: paint.neon ? color : 0x000000, emissiveIntensity: paint.neon ? 0.45 : 0 });
  }
  return new MeshStandardMaterial({
    color,
    metalness: paint.metal ?? 0.5,
    roughness: paint.rough ?? 0.35,
    emissive: paint.neon ? color : new Color(0),
    emissiveIntensity: paint.neon ? 0.5 : 0,
  });
}

function wheel(radius, width, rim) {
  const g = new Group();
  g.name = 'wheel';
  const tire = new Mesh(new CylinderGeometry(radius, radius, width, 18), new MeshLambertMaterial({ color: '#141414' }));
  tire.rotation.z = Math.PI / 2;
  g.add(tire);
  const rimColor = rim.color ?? '#c8ccd8';
  const rimMat = rim.neon
    ? new MeshBasicMaterial({ color: rimColor })
    : new MeshStandardMaterial({ color: rimColor, metalness: 0.9, roughness: 0.25 });
  const face = width / 2 + 0.01;
  const style = rim.style ?? 'classic';
  for (const side of [-1, 1]) {
    if (style === 'disc') {
      const d = new Mesh(new CylinderGeometry(radius * 0.72, radius * 0.72, 0.02, 18), rimMat);
      d.rotation.z = Math.PI / 2;
      d.position.x = side * face;
      g.add(d);
      continue;
    }
    const ring = new Mesh(new TorusGeometry(radius * 0.62, radius * 0.08, 6, 18), rimMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = side * face;
    g.add(ring);
    const spokes = { classic: 5, star: 3, mesh: 8, neon: 4 }[style] ?? 5;
    const thick = style === 'star' ? 0.16 : style === 'mesh' ? 0.04 : 0.08;
    for (let k = 0; k < spokes; k++) {
      const s = new Mesh(new BoxGeometry(0.02, radius * 1.2, thick), rimMat);
      s.position.x = side * face;
      s.rotation.x = (k / spokes) * Math.PI;
      g.add(s);
    }
  }
  return g;
}

function buildCar(def, { paint, rim = {}, glow = null, quality } = {}) {
  const b = def.body;
  const L = b.length;
  const W = b.width;
  const H = b.height;
  const shape = b.shape;
  const car = new Group();
  const body = new Group(); // tilts with suspension
  car.add(body);
  const paintMat = paintMaterial(paint ?? { color: b.paint, metal: 0.5 }, quality);
  const darkMat = new MeshLambertMaterial({ color: '#1a1a22' });
  const glassMat = quality?.standardMaterials === false
    ? new MeshLambertMaterial({ color: '#0c1830' })
    : new MeshStandardMaterial({ color: '#0a1428', metalness: 0.9, roughness: 0.08 });
  const headMat = new MeshBasicMaterial({ color: '#fffbe0' });
  const tailMat = new MeshBasicMaterial({ color: '#ff2040' });
  const formula = shape === 'formula';
  const wr = b.wheelRadius ?? (formula ? 0.42 : shape === 'truck' ? 0.55 : 0.38);
  const ww = formula ? 0.42 : 0.32;
  const base = wr * 0.75;

  const add = (geo, mat, x, y, z) => {
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    body.add(m);
    return m;
  };

  if (formula) {
    add(taperedBox(W * 0.42, H * 0.45, L * 0.95, { topW: 0.7 }), paintMat, 0, base + H * 0.22, 0.05);
    add(taperedBox(W * 0.95, H * 0.35, L * 0.32, { topW: 0.8, topL: 0.8 }), paintMat, 0, base + H * 0.18, -L * 0.12);
    add(new BoxGeometry(W * 1.05, 0.06, 0.5), paintMat, 0, base * 0.55, L * 0.5);
    const wing = add(new BoxGeometry(W * 0.95, 0.08, 0.55), darkMat, 0, base + H * 0.95, -L * 0.48);
    wing.rotation.x = -0.15;
    add(new BoxGeometry(0.06, H * 0.5, 0.3), darkMat, W * 0.3, base + H * 0.65, -L * 0.45);
    add(new BoxGeometry(0.06, H * 0.5, 0.3), darkMat, -W * 0.3, base + H * 0.65, -L * 0.45);
    add(new SphereGeometry(0.24, 12, 8), new MeshStandardMaterial({ color: '#f5f5f5', metalness: 0.3, roughness: 0.3 }), 0, base + H * 0.6, -L * 0.05);
    add(new BoxGeometry(0.4, 0.08, 0.06), tailMat, 0, base + H * 0.3, -L * 0.5);
  } else {
    const lowH = H * (shape === 'sport' ? 0.38 : 0.42);
    add(taperedBox(W, lowH, L, { topW: 0.96, topL: 0.98 }), paintMat, 0, base + lowH / 2, 0);
    const cabin = {
      hatch: { l: 0.5, h: 0.5, z: -0.08, topL: 0.75, shift: -0.05 },
      sport: { l: 0.42, h: 0.42, z: -0.05, topL: 0.55, shift: -0.08 },
      luxury: { l: 0.55, h: 0.46, z: -0.06, topL: 0.75, shift: -0.02 },
      truck: { l: 0.36, h: 0.55, z: 0.18, topL: 0.85, shift: 0 },
      buggy: { l: 0.4, h: 0.55, z: -0.02, topL: 0.7, shift: 0 },
    }[shape] ?? { l: 0.5, h: 0.5, z: -0.08, topL: 0.75, shift: -0.05 };
    const ch = H * cabin.h;
    add(taperedBox(W * 0.86, ch, L * cabin.l, { topW: 0.82, topL: cabin.topL, shiftZ: cabin.shift * L }), glassMat, 0, base + lowH + ch / 2, L * cabin.z);
    add(taperedBox(W * 0.8, 0.06, L * cabin.l * cabin.topL * 0.95), paintMat, 0, base + lowH + ch, L * (cabin.z + cabin.shift));
    for (const side of [-1, 1]) {
      add(new BoxGeometry(W * 0.22, 0.12, 0.05), headMat, side * W * 0.32, base + lowH * 0.7, L / 2 + 0.01);
      add(new BoxGeometry(W * 0.26, 0.1, 0.05), tailMat, side * W * 0.3, base + lowH * 0.72, -L / 2 - 0.01);
    }
    if (shape === 'sport' || b.spoiler) {
      add(new BoxGeometry(W * 0.95, 0.06, 0.4), darkMat, 0, base + lowH + 0.32, -L * 0.45);
      add(new BoxGeometry(0.06, 0.3, 0.2), darkMat, W * 0.3, base + lowH + 0.15, -L * 0.45);
      add(new BoxGeometry(0.06, 0.3, 0.2), darkMat, -W * 0.3, base + lowH + 0.15, -L * 0.45);
    }
    if (shape === 'luxury') add(new BoxGeometry(W * 0.5, lowH * 0.5, 0.06), new MeshStandardMaterial({ color: '#d8dce8', metalness: 1, roughness: 0.2 }), 0, base + lowH * 0.45, L / 2 + 0.02);
    if (shape === 'truck') add(new BoxGeometry(W * 1.02, 0.18, 0.25), darkMat, 0, base + 0.15, L / 2 + 0.05);
  }

  // Wheels.
  const wheels = [];
  const wx = formula ? W / 2 + ww * 0.2 : W / 2 - ww * 0.35;
  const wz = L * (formula ? 0.36 : 0.32);
  for (const [x, z, front] of [[wx, wz, true], [-wx, wz, true], [wx, -wz, false], [-wx, -wz, false]]) {
    const pivot = new Group();
    pivot.position.set(x, wr, z);
    const w = wheel(formula && !front ? wr * 1.08 : wr, ww, rim);
    pivot.add(w);
    pivot.userData.front = front;
    pivot.userData.spin = w;
    car.add(pivot);
    wheels.push(pivot);
  }

  // Underglow.
  let underglow = null;
  if (glow) {
    const g = new Mesh(
      new PlaneGeometry(W * 2.2, L * 1.5),
      new MeshBasicMaterial({ map: blobTexture(glow), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
    );
    g.rotation.x = -Math.PI / 2;
    g.position.y = 0.06;
    g.renderOrder = 3;
    car.add(g);
    underglow = g;
  }
  car.userData.parts = { wheels, body, underglow, paint: paintMat };
  return car;
}

registerModel('car', buildCar);

/** Dark blob under the car (cheap fake shadow). */
export function createShadow(width, length) {
  const m = new Mesh(
    new PlaneGeometry(width * 1.5, length * 1.25),
    new MeshBasicMaterial({ map: blobTexture('rgba(0,0,0,0.75)'), transparent: true, depthWrite: false }),
  );
  m.renderOrder = 1;
  return m;
}
