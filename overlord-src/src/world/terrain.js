// The moon's surface: height, ground mesh, rocks.

import * as THREE from 'three';
import { createNoise, smoothstep } from '../engine/noise.js';
import { TEX } from './textures.js';

const n = createNoise(2024);

export const WORLD_RADIUS = 560; // the player cannot walk farther than this from the base
const FLAT_RADIUS = 105; // perfectly level ground for the base and the landing field
const SIZE = 1400;
const SEGMENTS = 320;

// A few old impact craters: [x, z, radius, depth]
const CRATERS = [
  [-190, 40, 62, 13], [150, -210, 44, 9], [240, 150, 80, 15], [-90, 260, 36, 7],
  [-300, -220, 95, 18], [60, 330, 50, 9], [330, -40, 40, 8], [-380, 150, 55, 10],
];

/** Ground height in metres at any point. The mesh and the physics both use this. */
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const wild = smoothstep(FLAT_RADIUS, FLAT_RADIUS + 90, d); // 0 at the base → 1 in the open
  let h = n.fbm(x * 0.0045, z * 0.0045, 4) * 22 + n.fbm(x * 0.021 + 40, z * 0.021, 3) * 2.6;
  const far = smoothstep(230, 520, d);
  h += n.ridged(x * 0.0032 + 7, z * 0.0032, 5) * 130 * far * far;
  for (const [cx, cz, r, depth] of CRATERS) {
    const q = Math.hypot(x - cx, z - cz) / r;
    if (q < 1.7) h += (q < 1 ? -depth * (1 - q * q) : 0) + depth * 0.38 * Math.exp(-(((q - 1) / 0.22) ** 2));
  }
  return h * wild + n.fbm(x * 0.09, z * 0.09, 2) * 0.12 * smoothstep(70, 110, d);
}

export function createTerrain(scene) {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  // Tint each vertex: pale dust on flats, dark rock on slopes, rusty and ashen patches.
  const dust = new THREE.Color('#7f756b'), rock = new THREE.Color('#3d3936'), rust = new THREE.Color('#7b5f4f'), ash = new THREE.Color('#55565c');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const normal = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const slope = 1 - normal.getY(i);
    c.copy(dust).lerp(rust, smoothstep(0.1, 0.5, n.fbm(x * 0.006 + 90, z * 0.006, 3) + 0.2));
    c.lerp(ash, smoothstep(0.0, 0.45, n.fbm(x * 0.012, z * 0.012 + 33, 3)));
    c.lerp(rock, smoothstep(0.06, 0.35, slope));
    c.multiplyScalar(0.86 + n.noise(x * 0.3, z * 0.3) * 0.1);
    c.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.attributes.uv.array.forEach((v, i, a) => (a[i] = v * 170));

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, map: TEX.ground.map, normalMap: TEX.ground.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.96, metalness: 0,
  });
  const ground = new THREE.Mesh(geo, material);
  ground.receiveShadow = true;
  scene.add(ground);

  const colliders = scatterRocks(scene);
  return { colliders };
}

function rockGeometry(seed) {
  const r = createNoise(seed);
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const bump = 1 + r.fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z, 3) * 0.75 + r.noise(v.x * 4, v.z * 4 + v.y * 3) * 0.08;
    v.multiplyScalar(bump);
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Boulders and pebbles. Returns circles ({ x, z, r }) for the big ones so the player walks around them. */
function scatterRocks(scene) {
  const material = new THREE.MeshStandardMaterial({
    color: '#6b6058', map: TEX.ground.map, normalMap: TEX.ground.normalMap, normalScale: new THREE.Vector2(2, 2), roughness: 0.92,
  });
  const colliders = [];
  const dummy = new THREE.Object3D();
  const r = createNoise(5).random;
  // [how many, smallest, largest, closest to the base, farthest]
  const groups = [[900, 0.15, 0.7, 22, 420], [260, 0.8, 2.6, 96, 480], [46, 3.5, 11, 125, 500]];
  groups.forEach(([count, min, max, near, far], g) => {
    for (let variant = 0; variant < 2; variant++) {
      const mesh = new THREE.InstancedMesh(rockGeometry(g * 10 + variant + 1), material, Math.ceil(count / 2));
      mesh.castShadow = mesh.receiveShadow = true;
      for (let i = 0; i < mesh.count; i++) {
        let x, z;
        do {
          const angle = r() * Math.PI * 2, dist = near + (far - near) * Math.sqrt(r());
          x = Math.cos(angle) * dist;
          z = Math.sin(angle) * dist;
        } while (g === 0 && Math.abs(x) < 52 && z > -52 && z < 100); // keep the base and landing field clear
        const size = min + (max - min) * r() ** 2.2;
        const tall = g === 2 && r() < 0.35 ? 1.6 + r() * 1.4 : 0.7 + r() * 0.6; // some big ones are spires
        dummy.position.set(x, heightAt(x, z) - size * 0.25, z);
        dummy.rotation.set(r() * 0.5, r() * 6.28, r() * 0.5);
        dummy.scale.set(size * (0.8 + r() * 0.5), size * tall, size * (0.8 + r() * 0.5));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (size > 0.9) colliders.push({ x, z, r: size * 0.95 });
      }
      scene.add(mesh);
    }
  });
  return colliders;
}
