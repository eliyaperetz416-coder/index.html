// MODEL LOADER LAYER
// Everything visual (vehicles, buildings, street lights) is created through this file.
// To swap in nicer 3D models later, replace the body of createVehicle()/createBuildingKit() so they
// return the same shape (a THREE.Group with userData.length/width) - no game logic needs to change.
// A glTF loader can be dropped in via models.register('car', 'myBody', async spec => group).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const BODY = 0xffffff; // vertex colour that takes the material colour
const GLASS = 0x0b1220;
const BLACK = 0x07070a;

const geoCache = new Map();
const matCache = new Map();
const registry = new Map(); // `${kind}:${body}` -> custom builder

export const glowTexture = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

function paint(geo, faceColors) {
  // BoxGeometry has 4 vertices per face in order +x,-x,+y,-y,+z,-z. faceColors: array of 6 (or single value).
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const fc = Array.isArray(faceColors) ? faceColors[Math.min(5, Math.floor(i / 4))] : faceColors;
    col.set(fc); arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
const box = (w, h, d, x, y, z, colors = BODY) => {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, colors);
};
// box whose top is scaled in x/z (cabin shape)
const tapered = (w, h, d, x, y, z, topX, topZ, colors, zShift = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * topX); p.setZ(i, p.getZ(i) * topZ + zShift); }
  g.computeVertexNormals(); g.translate(x, y, z); return paint(g, colors);
};
const wheel = (r, w, x, y, z) => {
  const g = new THREE.CylinderGeometry(r, r, w, 14); g.rotateZ(Math.PI / 2); g.translate(x, y, z);
  return paint(g, BLACK);
};
const lightBox = (w, h, d, x, y, z, color) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, color); };
const glowQuad = (size, x, y, z, color, facing) => {
  const g = new THREE.PlaneGeometry(size * 1.8, size);
  if (facing < 0) g.rotateY(Math.PI);
  g.translate(x, y, z); return paint(g, color);
};

const TAIL = 0xff1530, HEAD = 0xfff0c4;

// Returns { body: geo, lights: geo, glow: geo } for a vehicle spec; cached per spec shape.
function buildVehicleGeometry(spec) {
  const { body, length: L, width: W, height: H } = spec;
  const parts = []; const lights = []; const glows = [];
  const gc = 0.24;
  const addWheels = (r = 0.34, zf = 0.33, zr = 0.32, wx = 0.5) => {
    for (const sx of [-1, 1]) for (const z of [-L * zf, L * zr]) parts.push(wheel(r, 0.26, sx * (W * wx - 0.08), r, z));
  };
  const tail = (y, spread = 0.36, w = 0.4, h = 0.13) => {
    for (const sx of [-1, 1]) {
      lights.push(lightBox(w, h, 0.06, sx * W * spread, y, L / 2, TAIL));
      glows.push(glowQuad(0.95, sx * W * spread, y, L / 2 + 0.05, TAIL, 1));
    }
  };
  const head = (y, spread = 0.34, w = 0.36, h = 0.13) => {
    for (const sx of [-1, 1]) {
      lights.push(lightBox(w, h, 0.06, sx * W * spread, y, -L / 2, HEAD));
      glows.push(glowQuad(1.0, sx * W * spread, y, -L / 2 - 0.05, HEAD, -1));
    }
  };

  if (body === 'formula') {
    parts.push(box(W * 0.3, 0.34, L * 0.7, 0, 0.36, 0.05));                      // monocoque
    parts.push(tapered(W * 0.2, 0.22, L * 0.34, 0, 0.3, -L * 0.36, 0.45, 0.5, BODY));   // nose
    parts.push(box(W * 0.62, 0.26, L * 0.28, 0, 0.3, 0.12, BODY));              // sidepods
    parts.push(box(W * 0.18, 0.2, 0.7, 0, 0.62, 0.2, BLACK));                    // cockpit / airbox
    parts.push(box(W * 1.0, 0.05, 0.55, 0, 0.14, -L / 2 + 0.2, BLACK));         // front wing
    parts.push(box(W * 0.85, 0.06, 0.5, 0, 0.92, L / 2 - 0.3, BLACK));          // rear wing
    parts.push(box(0.08, 0.5, 0.3, 0, 0.66, L / 2 - 0.35, BLACK));
    for (const sx of [-1, 1]) parts.push(box(0.05, 0.4, 0.6, sx * W * 0.43, 0.9, L / 2 - 0.3, BLACK));
    for (const sx of [-1, 1]) { parts.push(wheel(0.34, 0.42, sx * (W / 2 - 0.2), 0.34, -L * 0.3)); parts.push(wheel(0.4, 0.5, sx * (W / 2 - 0.22), 0.4, L * 0.3)); }
    for (const sx of [-1, 1]) { lights.push(lightBox(0.12, 0.2, 0.05, sx * 0.14, 0.78, L / 2 - 0.05, TAIL)); }
    glows.push(glowQuad(1.1, 0, 0.78, L / 2 + 0.05, TAIL, 1));
    lights.push(lightBox(0.5, 0.08, 0.06, 0, 0.4, L / 2 + 0.0, TAIL));
    head(0.3, 0.1, 0.16, 0.08);
    return finalize(parts, lights, glows);
  }
  if (body === 'truck') {
    const cabL = 2.3;
    parts.push(box(W, H * 0.6, cabL, 0, gc + H * 0.3, -L / 2 + cabL / 2, BODY));
    parts.push(box(W * 0.9, H * 0.22, 0.05, 0, gc + H * 0.44, -L / 2 - 0.0, GLASS));
    parts.push(box(W * 1.02, H * 0.82, L - cabL - 0.2, 0, gc + H * 0.41 + 0.15, L / 2 - (L - cabL) / 2 + 0.0, 0xd9dde6));
    addWheels(0.5, 0.36, 0.3, 0.5); parts.push(wheel(0.5, 0.3, -W / 2 + 0.2, 0.5, L * 0.18)); parts.push(wheel(0.5, 0.3, W / 2 - 0.2, 0.5, L * 0.18));
    tail(gc + 0.5, 0.4, 0.4, 0.2); head(gc + 0.5, 0.36, 0.4, 0.2);
    return finalize(parts, lights, glows);
  }

  // car-like bodies
  const cfg = {
    sedan: { lh: 0.42, cabL: 0.5, cabW: 0.86, cabShift: 0.06, topX: 0.84, topZ: 0.72 },
    sport: { lh: 0.38, cabL: 0.42, cabW: 0.84, cabShift: 0.1, topX: 0.78, topZ: 0.6 },
    limo:  { lh: 0.42, cabL: 0.62, cabW: 0.88, cabShift: 0.02, topX: 0.88, topZ: 0.85 },
    suv:   { lh: 0.4, cabL: 0.66, cabW: 0.9, cabShift: 0.1, topX: 0.92, topZ: 0.9 },
    van:   { lh: 0.38, cabL: 0.84, cabW: 0.92, cabShift: 0.07, topX: 0.96, topZ: 0.96 },
  }[body] || null;
  const c = cfg || { lh: 0.42, cabL: 0.5, cabW: 0.86, cabShift: 0.06, topX: 0.84, topZ: 0.72 };
  const lh = H * c.lh, ch = H - gc - lh;
  parts.push(box(W, lh, L, 0, gc + lh / 2, 0, BODY));
  const cabColors = [GLASS, GLASS, BODY, GLASS, GLASS, GLASS];
  parts.push(tapered(W * c.cabW, ch, L * c.cabL, 0, gc + lh + ch / 2, L * c.cabShift, c.topX, c.topZ, cabColors));
  if (body === 'sport') {
    parts.push(box(W * 0.9, 0.05, 0.38, 0, gc + lh + 0.42, L / 2 - 0.2, BLACK));
    for (const sx of [-1, 1]) parts.push(box(0.06, 0.34, 0.18, sx * W * 0.32, gc + lh + 0.22, L / 2 - 0.2, BLACK));
    parts.push(box(W * 0.98, 0.06, 0.3, 0, 0.2, -L / 2 + 0.08, BLACK)); // splitter
  }
  addWheels(body === 'suv' || body === 'van' ? 0.4 : 0.34);
  tail(gc + lh * 0.72); head(gc + lh * 0.6);
  if (body === 'sport') lights.push(lightBox(W * 0.7, 0.07, 0.06, 0, gc + lh * 0.72, L / 2 + 0.0, TAIL));
  return finalize(parts, lights, glows);
}

function finalize(parts, lights, glows) {
  const m = (a) => (a.length ? mergeGeometries(a) : null);
  const out = { body: m(parts), lights: m(lights), glow: m(glows) };
  parts.forEach((g) => g.dispose()); lights.forEach((g) => g.dispose()); glows.forEach((g) => g.dispose());
  return out;
}

const wetCache = new Map();
function wetGeometry(spec) {
  const key = `${spec.length}|${spec.width}`;
  if (!wetCache.has(key)) {
    const L = spec.length, W = spec.width, a = [];
    for (const sx of [-1, 1]) {
      const r = new THREE.PlaneGeometry(0.9, 7).rotateX(-Math.PI / 2); r.translate(sx * W * 0.34, 0.045, L / 2 + 3.6); a.push(paint(r, TAIL));
      const f = new THREE.PlaneGeometry(1.1, 11).rotateX(-Math.PI / 2); f.translate(sx * W * 0.32, 0.045, -L / 2 - 5.6); a.push(paint(f, HEAD));
    }
    wetCache.set(key, mergeGeometries(a)); a.forEach((g) => g.dispose());
  }
  return wetCache.get(key);
}
const bodyMat = (color) => {
  const k = 'b' + color;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshPhongMaterial({ color, vertexColors: true, shininess: 70, specular: 0x6a6a88 }));
  return matCache.get(k);
};
const lightMat = () => {
  if (!matCache.has('l')) matCache.set('l', new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  return matCache.get('l');
};
const glowMat = () => {
  if (!matCache.has('g')) matCache.set('g', new THREE.MeshBasicMaterial({
    vertexColors: true, map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.9,
  }));
  return matCache.get('g');
};

export const models = {
  register(kind, body, builder) { registry.set(`${kind}:${body}`, builder); },

  /** spec: { type:'car', body, color, length, width, height } -> THREE.Group, origin at ground centre, nose towards -Z */
  createVehicle(spec, colorOverride) {
    const custom = registry.get(`car:${spec.body}`);
    if (custom) return custom(spec, colorOverride);
    const key = `${spec.body}|${spec.length}|${spec.width}|${spec.height}`;
    if (!geoCache.has(key)) geoCache.set(key, buildVehicleGeometry(spec));
    const geo = geoCache.get(key);
    const g = new THREE.Group();
    const body = new THREE.Mesh(geo.body, bodyMat(colorOverride ?? spec.color ?? 0x888888));
    g.add(body);
    if (geo.lights) g.add(new THREE.Mesh(geo.lights, lightMat()));
    if (geo.glow) { const gl = new THREE.Mesh(geo.glow, glowMat()); gl.renderOrder = 5; g.add(gl); g.userData.glow = gl; }
    const wet = new THREE.Mesh(wetGeometry(spec), glowMat()); wet.visible = false; wet.renderOrder = 4; g.add(wet); g.userData.wet = wet;
    g.userData.length = spec.length; g.userData.width = spec.width; g.userData.height = spec.height;
    return g;
  },

  /** wet-road light reflections under a vehicle (rain worlds) */
  setWet(group, on) { if (group.userData.wet) group.userData.wet.visible = !!on; },

  setVehicleColor(group, color) { const b = group.children[0]; if (b && b.isMesh) b.material = bodyMat(color); },

  /** Street light kit (for instancing). Right-hand pole; the arm reaches towards -X (towards the road). */
  createStreetlightKit(color = 0xffd9a0) {
    const pole = [box(0.18, 8.8, 0.18, 0, 4.4, 0, 0x2a2a38), box(2.8, 0.12, 0.12, -1.4, 8.7, 0, 0x2a2a38)];
    const lamp = [box(0.9, 0.1, 0.45, -2.7, 8.6, 0, color)];
    const pool = new THREE.PlaneGeometry(9, 14); pool.rotateX(-Math.PI / 2); pool.translate(-3.2, 0.06, 0); paint(pool, color);
    const g = (a) => mergeGeometries(a);
    return { pole: g(pole), lamp: g(lamp), pool };
  },

  /** Overhead sign gantry spanning the road (for instancing). */
  createGantryKit(roadWidth, color = 0x00e5ff) {
    const parts = [
      box(0.5, 8.6, 0.5, -roadWidth / 2 - 0.6, 4.3, 0, 0x22222e), box(0.5, 8.6, 0.5, roadWidth / 2 + 0.6, 4.3, 0, 0x22222e),
      box(roadWidth + 1.7, 0.5, 0.5, 0, 7.2, 0, 0x22222e),
    ];
    const dim = new THREE.Color(color).multiplyScalar(0.28).getHex();
    const neon = [box(roadWidth + 1.2, 0.14, 0.14, 0, 6.85, 0.3, color), box(roadWidth * 0.46, 0.9, 0.1, 0, 7.9, 0.05, dim), box(roadWidth * 0.46 - 0.4, 0.1, 0.12, 0, 7.9, 0.1, color)];
    return { frame: mergeGeometries(parts), neon: mergeGeometries(neon) };
  },

  /** Building kit for a world: array of { geometry, material, w, h, d } classes (instanced by the world). */
  createBuildingKit(world) {
    const kit = [];
    const heights = [0.2, 0.4, 0.62, 0.82, 1].map((t) => world.buildings.minH + (world.buildings.maxH - world.buildings.minH) * t);
    const widths = [12, 18];
    const pal = world.buildings.palettes;
    pal.forEach((tint, pi) => {
      const mat = windowMaterial(tint, pi);
      for (const h of heights) for (const w of widths) {
        const g = new THREE.BoxGeometry(w, h, w * 0.9);
        scaleUV(g, w, h, w * 0.9);
        g.translate(0, h / 2, 0);
        kit.push({ geometry: g, material: mat, w, h, d: w * 0.9, tint });
      }
    });
    return kit;
  },
};

function scaleUV(g, w, h, d) {
  const uv = g.attributes.uv; const cell = 3.2;
  // faces order +x,-x,+y,-y,+z,-z ; 4 verts each
  for (let f = 0; f < 6; f++) {
    let su, sv;
    if (f < 2) { su = d / cell; sv = h / cell; } else if (f < 4) { su = 0.01; sv = 0.01; } else { su = w / cell; sv = h / cell; }
    for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * su, uv.getY(k) * sv); }
  }
}

const winCache = new Map();
function windowMaterial(tint, i) {
  const key = 'w' + tint;
  if (winCache.has(key)) return winCache.get(key);
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  const col = new THREE.Color(tint);
  const hex = (k) => `rgb(${Math.round(col.r * 255 * k)},${Math.round(col.g * 255 * k)},${Math.round(col.b * 255 * k)})`;
  let s = 1234 + i * 77; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const r = rnd();
    if (r < 0.34) { g.fillStyle = r < 0.12 ? '#ffe9b0' : hex(0.35 + rnd() * 0.65); g.fillRect(x * 16 + 3, y * 16 + 3, 10, 9); }
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  const mat = new THREE.MeshLambertMaterial({ color: 0x0c0a16, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6 });
  winCache.set(key, mat); return mat;
}
