// Scenery generators, picked by world.scenery.type. Everything is instanced so a whole skyline is
// a few draw calls. Objects are kept clear of the track using a coarse spatial hash.

import { InstancedMesh, BoxGeometry, MeshBasicMaterial, MeshLambertMaterial, Matrix4, Group, Color, SphereGeometry, CylinderGeometry, ConeGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three';
import { windowsTexture } from './textures.js';
import { rng, hash } from '../core/math.js';

/** Returns a function telling whether (x, z) is at least `clear` metres from the track. */
function clearance(path, clear) {
  const cell = 40;
  const grid = new Map();
  for (let i = 0; i < path.count; i += 8) {
    const x = path.P[i * 3];
    const z = path.P[i * 3 + 2];
    const k = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(x, z);
  }
  return (x, z, extra = 0) => {
    const cx = Math.floor(x / cell);
    const cz = Math.floor(z / cell);
    const c2 = (clear + extra) * (clear + extra);
    const reach = Math.ceil((clear + extra) / cell);
    for (let a = -reach; a <= reach; a++) {
      for (let b = -reach; b <= reach; b++) {
        const pts = grid.get(`${cx + a},${cz + b}`);
        if (!pts) continue;
        for (let i = 0; i < pts.length; i += 2) {
          const dx = pts[i] - x;
          const dz = pts[i + 1] - z;
          if (dx * dx + dz * dz < c2) return false;
        }
      }
    }
    return true;
  };
}

/** Candidate spots in a band along the track. */
function* spots(path, r, { every = 18, min = 40, max = 260 } = {}) {
  for (let i = 0; i < path.count; i += every * 2) {
    const o = i * 3;
    for (const side of [-1, 1]) {
      const d = min + r() * (max - min);
      const rx = path.R[o];
      const rz = path.R[o + 2];
      const len = Math.hypot(rx, rz) || 1;
      yield [path.P[o] + (rx / len) * d * side + (r() - 0.5) * 30, path.P[o + 2] + (rz / len) * d * side + (r() - 0.5) * 30, d];
    }
  }
}

function city(world, path, groundY, quality, r) {
  const group = new Group();
  const disposables = [];
  const ok = clearance(path, 22);
  const towers = [];
  const neons = [];
  const density = world.scenery.density * quality.scenery;
  for (const [x, z, d] of spots(path, r, { every: Math.round(16 / density) })) {
    const w = 14 + r() * 26;
    if (!ok(x, z, w * 0.7)) continue;
    const h = 30 + r() * r() * 190 + (d > 150 ? 60 : 0);
    towers.push([x, z, w, h, w * (0.6 + r() * 0.8)]);
    if (r() < 0.5) neons.push([x, z, w, h, Math.floor(r() * world.scenery.colors.length)]);
  }
  const geo = new BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const tex = windowsTexture(world.scenery.colors, hash(world.id));
  const m = new MeshBasicMaterial({ map: tex, color: '#b8a8ff' });
  const inst = new InstancedMesh(geo, m, Math.max(1, towers.length));
  const mx = new Matrix4();
  towers.forEach(([x, z, w, h, dpt], i) => {
    mx.makeScale(w, h, dpt).setPosition(x, groundY, z);
    inst.setMatrixAt(i, mx);
  });
  inst.count = towers.length;
  inst.computeBoundingSphere();
  group.add(inst);
  disposables.push(geo, m);

  // Neon strips on the edges of some towers and a beacon on top.
  if (neons.length) {
    const sg = new BoxGeometry(1, 1, 1);
    sg.translate(0, 0.5, 0);
    const sm = new MeshBasicMaterial({ color: '#ffffff' });
    const strips = new InstancedMesh(sg, sm, neons.length * 2);
    const c = new Color();
    let k = 0;
    for (const [x, z, w, h, ci] of neons) {
      c.set(world.scenery.colors[ci]);
      mx.makeScale(1.2, h * 0.9, 1.2).setPosition(x + w / 2, groundY, z + w * 0.3);
      strips.setMatrixAt(k, mx);
      strips.setColorAt(k++, c);
      mx.makeScale(w * 0.8, 2, w * 0.8).setPosition(x, groundY + h, z);
      strips.setColorAt(k, c);
      strips.setMatrixAt(k++, mx);
    }
    strips.computeBoundingSphere();
    group.add(strips);
    disposables.push(sg, sm);
  }
  return { group, disposables };
}

/** Desert: dunes, banded mesas and a few distant pyramids. */
function desert(world, path, groundY, quality, r) {
  const group = new Group();
  const disposables = [];
  const sc = world.scenery;
  const density = sc.density * quality.scenery;
  const okNear = clearance(path, 26);
  const m = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const sz = new Vector3();
  const up = new Vector3(0, 1, 0);

  // Dunes: flattened low-poly spheres, half buried.
  const dunes = [];
  for (const [x, z] of spots(path, r, { every: Math.round(14 / density), min: 30, max: 320 })) {
    const rad = 30 + r() * 70;
    if (!okNear(x, z, rad * 0.3)) continue;
    dunes.push([x, z, rad, 0.18 + r() * 0.16, r() * Math.PI]);
  }
  const duneGeo = new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const duneMat = new MeshLambertMaterial({ color: sc.sand });
  const dm = new InstancedMesh(duneGeo, duneMat, Math.max(1, dunes.length));
  dunes.forEach(([x, z, rad, k, rot], i) => {
    q.setFromAxisAngle(up, rot);
    m.compose(v.set(x, groundY - 1, z), q, sz.set(rad, rad * k, rad * 1.4));
    dm.setMatrixAt(i, m);
  });
  dm.count = dunes.length;
  dm.computeBoundingSphere();
  group.add(dm);
  disposables.push(duneGeo, duneMat);

  // Mesas: banded rock towers with flat tops, mostly further out.
  const mesas = [];
  for (const [x, z, d] of spots(path, r, { every: Math.round(40 / density), min: 120, max: 520 })) {
    const rad = 25 + r() * 45;
    if (!okNear(x, z, rad)) continue;
    mesas.push([x, z, rad, 40 + r() * 110 + d * 0.1, r() * Math.PI]);
  }
  const mesaGeo = new CylinderGeometry(0.82, 1, 1, 7, 6);
  mesaGeo.translate(0, 0.5, 0);
  // Horizontal bands of colour.
  const pos = mesaGeo.attributes.position;
  const cols = [];
  const rock = new Color(sc.rock);
  const light = new Color(sc.rock).lerp(new Color('#f0c090'), 0.35);
  for (let i = 0; i < pos.count; i++) {
    const band = Math.floor(pos.getY(i) * 6) % 2;
    const c = band ? rock : light;
    cols.push(c.r, c.g, c.b);
  }
  mesaGeo.setAttribute('color', new Float32BufferAttribute(cols, 3));
  const mesaMat = new MeshLambertMaterial({ vertexColors: true });
  const mm = new InstancedMesh(mesaGeo, mesaMat, Math.max(1, mesas.length));
  mesas.forEach(([x, z, rad, h, rot], i) => {
    q.setFromAxisAngle(up, rot);
    m.compose(v.set(x, groundY - 2, z), q, sz.set(rad, h, rad));
    mm.setMatrixAt(i, m);
  });
  mm.count = mesas.length;
  mm.computeBoundingSphere();
  group.add(mm);
  disposables.push(mesaGeo, mesaMat);

  // A few pyramids on the horizon.
  const mid = path.sampleAt(path.length / 2).pos;
  const pyrGeo = new ConeGeometry(1, 1, 4);
  pyrGeo.translate(0, 0.5, 0);
  const pyrMat = new MeshLambertMaterial({ color: '#c47a55', fog: false }); // hazy, beyond the fog
  const pm = new InstancedMesh(pyrGeo, pyrMat, 3);
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2;
    const d = 900 + r() * 300;
    const s = 160 + r() * 120;
    q.setFromAxisAngle(up, r());
    m.compose(v.set(mid.x + Math.cos(a) * d, groundY - 2, mid.z + Math.sin(a) * d), q, sz.set(s, s * 0.75, s));
    pm.setMatrixAt(i, m);
  }
  pm.computeBoundingSphere();
  group.add(pm);
  disposables.push(pyrGeo, pyrMat);
  return { group, disposables };
}

const GENERATORS = { city, desert };

/** Adds scenery for the world. Unknown types give an empty world (just ground and sky). */
export function buildScenery(world, path, groundY, quality) {
  const gen = GENERATORS[world.scenery?.type];
  if (!gen) return { group: new Group(), disposables: [] };
  return gen(world, path, groundY, quality, rng(hash(world.id + (path.def.id ?? ''))));
}

export function registerScenery(type, fn) {
  GENERATORS[type] = fn;
}

