// Ship models and the landing field they park on.

import * as THREE from 'three';
import { Kit } from '../engine/kit.js';
import { MAT } from '../world/materials.js';
import { padTexture } from '../world/textures.js';

/** A flat swept wing (or fin), cut from a four-cornered outline: [[x, z], …]. */
function wing(kit, material, outline, thickness, at, rot) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, thickness / 2, 0);
  kit.add(material, geo, at, rot);
}

/** Landing leg with a foot pad. */
function leg(kit, x, z, top, spread = 0.5) {
  kit.beam(MAT.steel, [x, top, z], [x + Math.sign(x) * spread, 0.12, z], 0.07);
  kit.cyl(MAT.frame, 0.26, 0.3, 0.12, [x + Math.sign(x) * spread, 0.06, z], [0, 0, 0], 12);
}

/** Rank stripes painted across the hull: one per level. */
function stripes(kit, level, width, y, z) {
  for (let i = 0; i < level; i++) kit.box(MAT.paint, width, 0.03, 0.22, [0, y, z - i * 0.4]);
}

const builders = {
  // Small, fast explorer: 9 m long. Nose points along +z.
  scout(kit, level) {
    const body = new THREE.LatheGeometry([[0, 4.6], [0.28, 4.2], [0.62, 3.2], [0.9, 1.6], [0.98, 0], [0.92, -2.2], [0.7, -3.6], [0, -3.6]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
    kit.add(MAT.hull, body.rotateX(Math.PI / 2).scale(1.15, 0.82, 1), [0, 1.75, 0]);
    kit.add(MAT.glass, new THREE.SphereGeometry(0.62, 18, 12).scale(0.9, 0.7, 1.9), [0, 2.28, 1.9]);
    kit.add(MAT.frame, new THREE.SphereGeometry(0.6, 18, 12).scale(0.86, 0.55, 1.8), [0, 2.2, 1.9]);
    for (const s of [-1, 1]) {
      wing(kit, MAT.hull, [[0, 1.4], [s * 3.9, -1.9], [s * 3.9, -2.8], [0, -2.6]], 0.14, [s * 0.7, 1.55, 0], [0, 0, s * -0.06]);
      wing(kit, MAT.hullDark, [[0, 0], [s * 0.1, -1.4], [s * 0.1, -2.0], [0, -1.9]], 1.3, [s * 1.2, 2.5, -1.5], [0, 0, s * -0.3]);
      kit.cyl(MAT.hullDark, 0.42, 0.5, 2.6, [s * 1.45, 1.6, -2.3], [Math.PI / 2, 0, 0], 16);
      kit.cyl(MAT.frame, 0.44, 0.34, 0.5, [s * 1.45, 1.6, -3.8], [Math.PI / 2, 0, 0], 16);
      kit.cyl(MAT.engine, 0.3, 0.3, 0.04, [s * 1.45, 1.6, -4.0], [Math.PI / 2, 0, 0], 16);
      kit.box(MAT.lampRed, 0.08, 0.06, 0.16, [s * 4.55, 1.38, -2.3]);
      leg(kit, s * 0.9, -1.6, 1.2);
    }
    kit.beam(MAT.steel, [0, 1.2, 2.4], [0, 0.12, 2.7], 0.07);
    kit.cyl(MAT.frame, 0.24, 0.28, 0.12, [0, 0.06, 2.7], [0, 0, 0], 12);
    stripes(kit, level, 1.9, 2.52, -0.2);
  },
  // Warship: 15 m long, slab-sided and heavy.
  frigate(kit, level) {
    kit.box(MAT.hull, 3.2, 2.2, 9.5, [0, 2.9, -0.8]);
    kit.box(MAT.hullDark, 3.5, 0.9, 8.6, [0, 2.2, -0.8]);
    kit.add(MAT.hull, new THREE.CylinderGeometry(0.5, 2.26, 3.6, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(1, 0.69, 1), [0, 2.9, 5.75]);
    kit.box(MAT.hullDark, 2.0, 1.0, 2.6, [0, 4.5, -1.6]);
    kit.box(MAT.glass, 2.04, 0.34, 1.6, [0, 4.72, -0.9]);
    kit.box(MAT.frame, 2.1, 0.12, 2.7, [0, 5.04, -1.6]);
    kit.cyl(MAT.steel, 0.03, 0.04, 2.2, [0.7, 6.1, -2.4]);
    for (const s of [-1, 1]) {
      kit.box(MAT.hullDark, 1.4, 0.4, 2.4, [s * 2.2, 2.9, -3.4]);
      kit.cyl(MAT.hull, 0.95, 1.05, 5.2, [s * 3.3, 2.9, -3.6], [Math.PI / 2, 0, 0], 18);
      kit.cyl(MAT.frame, 1.0, 0.75, 0.9, [s * 3.3, 2.9, -6.6], [Math.PI / 2, 0, 0], 18);
      kit.cyl(MAT.engine, 0.66, 0.66, 0.05, [s * 3.3, 2.9, -7.0], [Math.PI / 2, 0, 0], 18);
      kit.box(MAT.paint, 0.06, 0.5, 3.4, [s * 1.62, 3.3, 1.2]);
      kit.box(MAT.lampRed, 0.1, 0.08, 0.2, [s * 4.3, 2.9, -2.2]);
      leg(kit, s * 1.5, 2.2, 1.9, 0.9);
      leg(kit, s * 1.5, -3.6, 1.9, 0.9);
      // gun turrets
      kit.cyl(MAT.hullDark, 0.5, 0.6, 0.4, [s * 0.9, 4.2, 2.2], [0, 0, 0], 14);
      kit.beam(MAT.frame, [s * 0.9, 4.35, 2.4], [s * 0.9, 4.45, 4.3], 0.07);
    }
    stripes(kit, level, 3.24, 4.02, 1.2);
  },
  // The commander's own lander: boxy, with the rear ramp down and the cabin light on.
  lander(kit) {
    kit.box(MAT.hull, 3.4, 2.5, 5.6, [0, 2.75, 0]);
    kit.box(MAT.hullDark, 3.6, 0.5, 5.8, [0, 1.6, 0]);
    kit.box(MAT.glass, 2.8, 1.0, 0.1, [0, 3.2, 2.9], [-0.3, 0, 0]);
    kit.box(MAT.frame, 3.0, 1.2, 0.3, [0, 3.2, 2.72], [-0.3, 0, 0]);
    kit.box(MAT.paint, 3.42, 0.2, 5.62, [0, 2.2, 0]);
    kit.box(MAT.frame, 2.2, 2.0, 0.1, [0, 2.6, -2.76]);
    kit.box(MAT.lampWarm, 1.6, 0.06, 0.06, [0, 3.55, -2.84]);
    kit.box(MAT.deck, 2.0, 0.1, 2.9, [0, 0.72, -4.05], [-0.5, 0, 0]);
    for (const s of [-1, 1]) {
      kit.cyl(MAT.hullDark, 0.6, 0.7, 2.4, [s * 2.3, 2.6, -0.4], [0, 0, 0], 14);
      kit.cyl(MAT.frame, 0.55, 0.4, 0.5, [s * 2.3, 1.2, -0.4], [0, 0, 0], 14);
      leg(kit, s * 1.6, 2.2, 1.5, 1.0);
      leg(kit, s * 1.6, -2.2, 1.5, 1.0);
      kit.box(MAT.lampRed, 0.08, 0.08, 0.2, [s * 1.74, 4.0, 2.0]);
    }
    kit.cyl(MAT.steel, 0.03, 0.04, 1.8, [1.0, 4.9, -1.2]);
  },
};

/** Circle the player cannot walk through, per ship type. */
export const SHIP_RADIUS = { scout: 2.2, frigate: 4.2, lander: 3.1 };

export function buildShip(type, level = 1) {
  const kit = new Kit();
  builders[type](kit, level);
  const group = kit.build();
  group.scale.setScalar(1 + 0.07 * (level - 1));
  return group;
}

// --- the landing field: marked parking spots south of the base ---

const SPOT = 17; // metres between spots
export const LANDER_SPOT = { x: 21, z: 49, yaw: -2.3 };

/** World position of parking spot n (0, 1, 2 … fills rows of four). */
export function parkingSpot(n) {
  return { x: (((n % 4) - 1.5) * SPOT), z: 60 + Math.floor(n / 4) * SPOT, yaw: Math.PI };
}

export function createLandingField(scene, spots = 8) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ map: padTexture(), roughness: 0.92, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -2 });
  const lights = new Kit();
  for (let n = 0; n < spots; n++) {
    const p = parkingSpot(n);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), paint);
    mark.position.set(p.x, 0.02, p.z);
    mark.receiveShadow = true;
    group.add(mark);
    for (const [dx, dz] of [[-6, -6], [6, -6], [6, 6], [-6, 6]]) {
      lights.cyl(MAT.frame, 0.09, 0.12, 0.22, [p.x + dx, 0.11, p.z + dz], [0, 0, 0], 8);
      lights.cyl(MAT.lampAmber, 0.06, 0.06, 0.05, [p.x + dx, 0.24, p.z + dz], [0, 0, 0], 8);
    }
  }
  group.add(lights.build({ shadows: false }));
  scene.add(group);
}
