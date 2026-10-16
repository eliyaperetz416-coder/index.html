// Scenery generators, picked by world.scenery.type. Everything is instanced so a whole skyline is
// a few draw calls. Objects are kept clear of the track using a coarse spatial hash.

import { InstancedMesh, BoxGeometry, MeshBasicMaterial, Matrix4, Group, Color } from 'three';
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

const GENERATORS = { city };

/** Adds scenery for the world. Unknown types give an empty world (just ground and sky). */
export function buildScenery(world, path, groundY, quality) {
  const gen = GENERATORS[world.scenery?.type];
  if (!gen) return { group: new Group(), disposables: [] };
  return gen(world, path, groundY, quality, rng(hash(world.id + (path.def.id ?? ''))));
}

export function registerScenery(type, fn) {
  GENERATORS[type] = fn;
}

