// Builds the visible track from a TrackPath: road, walls, neon edges, supports, gates.
// The road is split into chunks so the renderer can skip the parts behind the camera.

import {
  BufferGeometry, Float32BufferAttribute, Mesh, Group, MeshLambertMaterial, MeshBasicMaterial,
  DoubleSide, AdditiveBlending, InstancedMesh, BoxGeometry, Matrix4, Color,
} from 'three';
import { STEP, F_SOLID, F_WALLS, F_LOOP, F_LIP } from '../track/path.js';
import { roadTexture, checkerTexture, stripeTexture, chevronTexture } from './textures.js';

const CHUNK = 360; // samples per mesh chunk (180 m)
export const WALL_HEIGHT = 1.1;

/** Contiguous runs of samples that pass `test(flags)`: [[i0, i1], ...] inclusive. */
function runs(path, test) {
  const out = [];
  let start = -1;
  for (let i = 0; i < path.count; i++) {
    const ok = test(path.flags[i]);
    if (ok && start < 0) start = i;
    if ((!ok || i === path.count - 1) && start >= 0) {
      const end = ok ? i : i - 1;
      if (end > start) out.push([start, end]);
      start = -1;
    }
  }
  return out;
}

/**
 * Strips between pairs of lines that run along the track, merged into one geometry.
 * Each strip is { a, b, color? } and each line is { k, o, h }: x = k * halfWidth + o across the
 * road, h above it. Strips with a colour get a vertex colour attribute (one draw call for many
 * neon lines).
 */
function ribbon(path, i0, i1, strips, vTile = 16) {
  if (!Array.isArray(strips)) strips = [strips];
  const n = i1 - i0 + 1;
  const total = n * 2 * strips.length;
  const pos = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const colored = strips.some((st) => st.color);
  const col = colored ? new Float32Array(total * 3) : null;
  const idx = [];
  const { P, R, U, W } = path;
  const c = new Color();
  strips.forEach((st, si) => {
    const base = si * n * 2;
    if (colored) c.set(st.color ?? '#ffffff');
    for (let j = 0; j < n; j++) {
      const i = i0 + j;
      const o = i * 3;
      const hw = W[i] / 2;
      for (let side = 0; side < 2; side++) {
        const line = side ? st.b : st.a;
        const x = line.k * hw + line.o;
        const h = line.h;
        const v = base + j * 2 + side;
        pos[v * 3] = P[o] + R[o] * x + U[o] * h;
        pos[v * 3 + 1] = P[o + 1] + R[o + 1] * x + U[o + 1] * h;
        pos[v * 3 + 2] = P[o + 2] + R[o + 2] * x + U[o + 2] * h;
        uv[v * 2] = side;
        uv[v * 2 + 1] = (i * STEP) / vTile;
        if (colored) {
          col[v * 3] = c.r;
          col[v * 3 + 1] = c.g;
          col[v * 3 + 2] = c.b;
        }
      }
      if (j < n - 1) {
        const A = base + j * 2;
        idx.push(A, A + 1, A + 2, A + 1, A + 3, A + 2);
      }
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  if (colored) g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Split [i0, i1] into overlapping chunks. */
function chunks(i0, i1) {
  const out = [];
  for (let a = i0; a < i1; a += CHUNK) out.push([a, Math.min(i1, a + CHUNK)]);
  return out;
}

/** Matrix that places an object on the track at (s, x, h), facing along the track. */
export function trackMatrix(path, s, x = 0, h = 0, out = new Matrix4()) {
  const f = path.sampleAt(s);
  const left = f.R.clone().negate();
  out.makeBasis(left, f.U, f.T);
  out.setPosition(f.pos.clone().addScaledVector(f.R, x).addScaledVector(f.U, h));
  return out;
}

export function buildTrackMeshes(path, world) {
  const group = new Group();
  group.name = 'track';
  const disposables = [];
  const mat = (m) => (disposables.push(m), m);

  const roadMat = mat(new MeshLambertMaterial({ map: roadTexture(world.road), side: DoubleSide }));
  const underMat = mat(new MeshLambertMaterial({ color: new Color(world.wall.color).multiplyScalar(0.7), side: DoubleSide }));
  const wallMat = mat(new MeshLambertMaterial({ color: world.wall.color, side: DoubleSide }));
  const neonMat = mat(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
  const glowMat = mat(new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));

  const add = (geo, m, order = 0) => {
    const mesh = new Mesh(geo, m);
    mesh.renderOrder = order;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    disposables.push(geo);
    return mesh;
  };

  // Five draw calls per 180 m chunk: road, underside, walls, neon lines, neon glow.
  for (const [r0, r1] of runs(path, (f) => f & F_SOLID)) {
    for (const [i0, i1] of chunks(r0, r1)) {
      add(ribbon(path, i0, i1, { a: { k: -1, o: 0, h: 0 }, b: { k: 1, o: 0, h: 0 } }), roadMat);
      add(ribbon(path, i0, i1, [
        { a: { k: -1, o: -0.3, h: -0.6 }, b: { k: 1, o: 0.3, h: -0.6 } },
        { a: { k: -1, o: -0.3, h: -0.6 }, b: { k: -1, o: 0, h: 0 } },
        { a: { k: 1, o: 0, h: 0 }, b: { k: 1, o: 0.3, h: -0.6 } },
      ]), underMat);
    }
  }
  const H = WALL_HEIGHT;
  const A = world.wall.neon;
  const B = world.wall.neonAlt;
  for (const [r0, r1] of runs(path, (f) => f & F_SOLID && f & F_WALLS)) {
    for (const [i0, i1] of chunks(r0, r1)) {
      add(ribbon(path, i0, i1, [
        { a: { k: -1, o: -0.15, h: 0 }, b: { k: -1, o: -0.15, h: H } },
        { a: { k: 1, o: 0.15, h: H }, b: { k: 1, o: 0.15, h: 0 } },
      ]), wallMat);
      add(ribbon(path, i0, i1, [
        { a: { k: -1, o: -0.4, h: H }, b: { k: -1, o: 0.1, h: H }, color: A },
        { a: { k: 1, o: -0.1, h: H }, b: { k: 1, o: 0.4, h: H }, color: B },
      ]), neonMat);
      add(ribbon(path, i0, i1, [
        { a: { k: -1, o: -1.4, h: H + 0.05 }, b: { k: -1, o: 1.0, h: H + 0.05 }, color: A },
        { a: { k: 1, o: -1.0, h: H + 0.05 }, b: { k: 1, o: 1.4, h: H + 0.05 }, color: B },
      ]), glowMat, 2);
    }
  }

  // Hazard stripes on jump lips, chevrons on landings.
  const stripeMat = mat(new MeshLambertMaterial({ map: stripeTexture(), side: DoubleSide }));
  const chevMat = mat(new MeshBasicMaterial({ map: chevronTexture('#ffd400'), transparent: true, depthWrite: false, side: DoubleSide }));
  for (const g of path.gaps) {
    const lipEnd = Math.round(g.s0 / STEP);
    add(ribbon(path, lipEnd - 5, lipEnd, { a: { k: -1, o: 0, h: 0.03 }, b: { k: 1, o: 0, h: 0.03 } }, 1e9), stripeMat, 1);
    const land = Math.round(g.s1 / STEP) + 4;
    add(ribbon(path, land, land + 14, { a: { k: -0.35, o: 0, h: 0.03 }, b: { k: 0.35, o: 0, h: 0.03 } }, 7), chevMat, 1);
  }

  // Start and finish gates.
  const checker = checkerTexture();
  const gateMat = mat(new MeshLambertMaterial({ color: '#1b1430' }));
  const bannerFinish = mat(new MeshBasicMaterial({ map: checker }));
  const bannerStart = mat(new MeshBasicMaterial({ color: world.wall.neonAlt }));
  const lineMat = mat(new MeshLambertMaterial({ map: checker, side: DoubleSide }));
  const gate = (s, banner) => {
    const hw = path.widthAt(s) / 2;
    const m = trackMatrix(path, s);
    const post = new BoxGeometry(0.8, 9, 0.8);
    const top = new BoxGeometry(hw * 2 + 2.4, 1.2, 0.5);
    disposables.push(post, top);
    for (const side of [-1, 1]) {
      const p = new Mesh(post, gateMat);
      p.position.set(side * (hw + 0.8), 4.5, 0);
      p.applyMatrix4(m);
      group.add(p);
    }
    const b = new Mesh(top, banner);
    b.position.set(0, 9, 0);
    b.applyMatrix4(m);
    group.add(b);
  };
  gate(path.startS + 22, bannerStart);
  gate(path.finishS, bannerFinish);
  const f0 = Math.round(path.finishS / STEP);
  add(ribbon(path, f0, f0 + 6, { a: { k: -1, o: 0, h: 0.03 }, b: { k: 1, o: 0, h: 0.03 } }, 3), lineMat, 1);

  // Support pillars under flat road.
  const groundY = path.minY - 45;
  const mats = [];
  for (let i = 0; i < path.count; i += 60) {
    const fl = path.flags[i];
    if (!(fl & F_SOLID) || fl & F_LOOP || fl & F_LIP) continue;
    const o = i * 3;
    if (path.U[o + 1] < 0.93) continue;
    const top = path.P[o + 1] - 0.6;
    const hgt = top - groundY;
    if (hgt < 2) continue;
    const m = new Matrix4().makeScale(2.2, hgt, 2.2);
    m.setPosition(path.P[o], groundY + hgt / 2, path.P[o + 2]);
    mats.push(m);
  }
  if (mats.length) {
    const geo = new BoxGeometry(1, 1, 1);
    const pm = mat(new MeshLambertMaterial({ color: world.wall.color }));
    const inst = new InstancedMesh(geo, pm, mats.length);
    mats.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.computeBoundingSphere();
    disposables.push(geo);
    group.add(inst);
  }

  group.userData.groundY = groundY;
  group.userData.dispose = () => {
    for (const d of disposables) d.dispose();
    group.clear();
  };
  return group;
}

