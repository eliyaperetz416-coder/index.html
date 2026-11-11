// The 3D models of every base module, built from the modelling kit.
// Rooms share one shell (walls, windows, doors, roof); each type adds its own fittings.
// All positions are in the module's own coordinates: centre of the cell, ground at y = 0.

import * as THREE from 'three';
import { Kit } from '../engine/kit.js';
import { MAT } from '../world/materials.js';
import { screenTexture, labelTexture, padTexture } from '../world/textures.js';
import { APOTHEM as A, WALL as T, FLOOR as F, WALL_H as H, DOOR_W, DOOR_H, SIDE, GAP } from './layout.js';

const OCT = Math.PI / 8;
const corner = (apothem) => apothem / Math.cos(OCT); // centre → corner of an octagon with this apothem
const TOP = F + H;

/** Eight-sided slab or ring with flat sides facing the neighbours. */
const octagon = (kit, material, apothemTop, apothemBottom, height, y) =>
  kit.add(material, new THREE.CylinderGeometry(corner(apothemTop), corner(apothemBottom), height, 8).rotateY(OCT), [0, y, 0]);

/** Add a box against wall `i`: `u` along the wall, `out` away from the centre. */
function onSide(kit, i, material, w, h, d, u, y, out = 0) {
  const a = (i * Math.PI) / 4, nx = Math.sin(a), nz = Math.cos(a);
  kit.box(material, w, h, d, [nx * (A + out) + nz * u, y, nz * (A + out) - nx * u], [0, a, 0]);
}

/** What each module type has standing on its floor: [x, z, radius] circles the player walks around. */
export const PROPS = {
  core: { circles: [[0, 0, 1.15], [-2.35, -2.35, 0.75], [2.35, -2.35, 0.75]] },
  habitat: { circles: [[-2.3, -2.3, 0.95], [2.3, -2.3, 0.95], [0, 0.2, 0.7]] },
  hydro: { circles: [[0, 0, 0.8], [-2.25, -2.25, 0.9], [2.25, -2.25, 0.9], [-2.25, 2.25, 0.9], [2.25, 2.25, 0.9]] },
  oxygen: { circles: [[-2.2, -2.2, 0.85], [2.2, -2.2, 0.85], [0, 0, 0.75]] },
  storage: { circles: [[-2.2, -2.2, 1.0], [2.2, -2.2, 1.0], [-2.3, 2.2, 0.9], [2.2, 2.3, 0.8]] },
  solar: { segments: [[-2.1, -3, -2.1, 3], [2.1, -3, 2.1, 3]] },
  mine: { circles: [[0, 0, 2.1], [2.8, -1.9, 1.3]] },
  shipyard: { circles: [[-2.3, -2.3, 1.9], [3.2, 3.2, 0.3], [-3.2, 3.2, 0.3]] },
};

/** Where the player can press "use": [x, z, what it opens, prompt]. */
export const TERMINALS = {
  core: [[0, 0, 'map', 'Star map'], [2.35, -2.35, 'fleet', 'Fleet command'], [-2.35, -2.35, 'war', 'War room']],
  shipyard: [[-2.3, -2.3, 'fleet', 'Shipyard console']],
};

/** Short code painted on each module's name plate. */
const CODES = { core: 'CMD', habitat: 'HAB', hydro: 'AGR', oxygen: 'OXY', storage: 'STO', solar: 'SOL', mine: 'MIN', shipyard: 'YRD' };

// ---------------------------------------------------------------- shell

function foundation(kit) {
  octagon(kit, MAT.concrete, A + 0.5, A + 0.62, 0.6, F - 0.3);
  octagon(kit, MAT.hullDark, A + 0.56, A + 0.56, 0.08, F - 0.1);
}

function wallSide(kit, i, kind) {
  const liner = (w, h, u, y) => onSide(kit, i, MAT.wall, w, h, 0.05, u, y, -T / 2 - 0.02);
  const full = SIDE + 0.08;
  if (kind === 'solid') {
    onSide(kit, i, MAT.hull, full, H, T, 0, F + H / 2);
    liner(SIDE - 0.2, H - 0.1, 0, F + H / 2);
    onSide(kit, i, MAT.hullDark, 1.25, 1.5, 0.06, -0.78, F + 1.75, T / 2);
    onSide(kit, i, MAT.hullDark, 1.25, 1.5, 0.06, 0.78, F + 1.75, T / 2);
    onSide(kit, i, MAT.paint, full, 0.14, T + 0.03, 0, F + 0.62);
  } else if (kind === 'window') {
    const sill = 1.0, head = 2.35;
    onSide(kit, i, MAT.hull, full, sill, T, 0, F + sill / 2);
    onSide(kit, i, MAT.hull, full, H - head, T, 0, F + (head + H) / 2);
    liner(SIDE - 0.2, sill - 0.05, 0, F + sill / 2);
    liner(SIDE - 0.2, H - head - 0.05, 0, F + (head + H) / 2);
    for (const u of [-SIDE / 2 + 0.14, SIDE / 2 - 0.14]) onSide(kit, i, MAT.hull, 0.36, head - sill, T, u, F + (sill + head) / 2);
    onSide(kit, i, MAT.glass, SIDE - 0.6, head - sill, 0.05, 0, F + (sill + head) / 2);
    onSide(kit, i, MAT.frame, 0.07, head - sill, T * 0.7, 0, F + (sill + head) / 2);
    for (const y of [sill, head]) onSide(kit, i, MAT.frame, SIDE - 0.5, 0.07, T + 0.06, 0, F + y);
  } else {
    // a doorway (to a corridor or the airlock)
    const w = (full - DOOR_W) / 2;
    for (const s of [-1, 1]) {
      onSide(kit, i, MAT.hull, w, H, T, s * (DOOR_W / 2 + w / 2), F + H / 2);
      liner(w - 0.1, H - 0.1, s * (DOOR_W / 2 + w / 2), F + H / 2);
      onSide(kit, i, MAT.frame, 0.12, DOOR_H, T + 0.14, s * (DOOR_W / 2 + 0.03), F + DOOR_H / 2);
    }
    onSide(kit, i, MAT.hull, DOOR_W, H - DOOR_H, T, 0, F + (DOOR_H + H) / 2);
    onSide(kit, i, MAT.frame, DOOR_W + 0.2, 0.12, T + 0.14, 0, F + DOOR_H + 0.03);
    onSide(kit, i, MAT.lampWarm, 0.5, 0.05, 0.04, 0, F + DOOR_H + 0.22, -T / 2 - 0.03);
  }
}

/** Walls, corner posts, roof and floor of a room. `sides` comes from the floor plan. */
function shell(kit, sides, { glassRoof = false } = {}) {
  foundation(kit);
  sides.forEach((kind, i) => wallSide(kit, i, kind));
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * (Math.PI / 4), r = corner(A);
    kit.box(MAT.hullDark, 0.4, H + 0.3, 0.4, [Math.sin(a) * r, F + H / 2 + 0.1, Math.cos(a) * r], [0, a, 0]);
  }
  octagon(kit, MAT.deck, A - 0.1, A - 0.1, 0.03, F + 0.012);
  octagon(kit, MAT.hullDark, A + 0.32, A + 0.32, 0.16, TOP + 0.05);
  if (glassRoof) {
    // open ring with a greenhouse dome
    kit.add(MAT.hull, new THREE.CylinderGeometry(2.9, corner(A + 0.2), 0.7, 8, 1, true).rotateY(OCT), [0, TOP + 0.45, 0]);
    kit.add(MAT.wall, new THREE.RingGeometry(2.75, corner(A - 0.15), 8, 1).rotateX(Math.PI / 2).rotateY(OCT), [0, TOP - 0.02, 0], [0, 0, 0], true);
    kit.add(MAT.glass, new THREE.SphereGeometry(2.9, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1), [0, TOP + 0.8, 0]);
    kit.add(MAT.hullDark, new THREE.TorusGeometry(2.9, 0.09, 8, 32).rotateX(Math.PI / 2), [0, TOP + 0.8, 0]);
    for (let k = 0; k < 4; k++) kit.add(MAT.frame, new THREE.TorusGeometry(2.9, 0.045, 6, 24, Math.PI).scale(1, 0.62, 1), [0, TOP + 0.8, 0], [0, (k * Math.PI) / 4, 0]);
  } else {
    kit.add(MAT.hull, new THREE.CylinderGeometry(2.5, corner(A + 0.2), 0.85, 8).rotateY(OCT), [0, TOP + 0.53, 0]);
    octagon(kit, MAT.wall, A - 0.12, A - 0.12, 0.05, TOP - 0.02);
    kit.cyl(MAT.hullDark, 2.25, 2.4, 0.14, [0, TOP + 1.0, 0], [0, 0, 0], 8);
    // ceiling light
    kit.cyl(MAT.frame, 0.72, 0.72, 0.06, [0, TOP - 0.07, 0], [0, 0, 0], 20);
    kit.cyl(MAT.lampWarm, 0.6, 0.6, 0.03, [0, TOP - 0.11, 0], [0, 0, 0], 20);
  }
}

// ---------------------------------------------------------------- room fittings

function console_(kit, x, z, title, accent, seed, extras) {
  const a = Math.atan2(-x, -z); // face the middle of the room
  const group = new Kit();
  group.box(MAT.hullDark, 1.5, 0.82, 0.62, [0, 0.41, 0]);
  group.box(MAT.frame, 1.56, 0.05, 0.7, [0, 0.84, 0.02]);
  group.box(MAT.frame, 1.5, 0.95, 0.07, [0, 1.42, -0.22], [-0.24, 0, 0]);
  group.box(MAT.lampCool, 0.5, 0.012, 0.16, [-0.35, 0.872, 0.12]);
  kit.merge(group, [x, F, z], a);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.38, 0.84),
    new THREE.MeshBasicMaterial({ map: screenTexture(title, accent, seed), toneMapped: false, color: '#b8b8b8' }),
  );
  screen.position.set(0, 1.43, -0.18);
  screen.rotation.x = -0.24;
  const holder = new THREE.Group();
  holder.position.set(x, F, z);
  holder.rotation.y = a;
  holder.add(screen);
  extras.push(holder);
}

const fittings = {
  core(kit, extras) {
    // The star-map table in the middle of the room.
    kit.cyl(MAT.hullDark, 0.95, 1.05, 0.78, [0, F + 0.39, 0], [0, 0, 0], 24);
    kit.cyl(MAT.frame, 1.08, 1.08, 0.06, [0, F + 0.8, 0], [0, 0, 0], 32);
    kit.cyl(MAT.tableTop, 0.96, 0.96, 0.012, [0, F + 0.835, 0], [0, 0, 0], 32);
    kit.add(MAT.holo, new THREE.TorusGeometry(0.7, 0.012, 6, 48).rotateX(Math.PI / 2), [0, F + 0.845, 0]);
    kit.add(MAT.holo, new THREE.TorusGeometry(0.34, 0.008, 6, 36).rotateX(Math.PI / 2), [0, F + 0.845, 0]);
    kit.add(MAT.steel, new THREE.TorusGeometry(1.08, 0.025, 8, 40).rotateX(Math.PI / 2), [0, F + 0.83, 0]);
    const globe = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 2),
      new THREE.MeshBasicMaterial({ color: '#58c8d2', wireframe: true, transparent: true, opacity: 0.28 }),
    );
    globe.position.set(0, F + 1.5, 0);
    globe.userData.spin = 0.25;
    extras.push(globe);
    console_(kit, 2.35, -2.35, 'FLEET', '#9ad0d6', 4, extras);
    console_(kit, -2.35, -2.35, 'FRONT LINE', '#e2a56b', 9, extras);
    // Roof: comms dish and mast.
    kit.cyl(MAT.steel, 0.07, 0.09, 1.4, [0.9, TOP + 1.7, -0.6]);
    kit.ball(MAT.hull, 0.75, [0.9, TOP + 2.9, -0.6]);
    kit.cyl(MAT.hullDark, 0.5, 0.6, 0.25, [0.9, TOP + 2.3, -0.6]);
    kit.cyl(MAT.steel, 0.03, 0.05, 4.2, [-1.1, TOP + 3.1, 0.7]);
  },
  habitat(kit) {
    for (const s of [-1, 1]) {
      const bunk = new Kit();
      for (const y of [0.42, 1.5]) {
        bunk.box(MAT.frame, 2.0, 0.08, 0.95, [0, y, 0]);
        bunk.box(MAT.fabric, 1.9, 0.14, 0.86, [0, y + 0.11, 0]);
        bunk.box(MAT.wall, 0.5, 0.1, 0.6, [-0.65, y + 0.22, 0]);
      }
      for (const x of [-0.98, 0.98]) for (const z of [-0.45, 0.45]) bunk.box(MAT.frame, 0.06, 2.1, 0.06, [x, 1.05, z]);
      kit.merge(bunk, [s * 2.3, F, -2.3], Math.atan2(s, -1));
    }
    kit.cyl(MAT.hullDark, 0.08, 0.3, 0.74, [0, F + 0.37, 0.2]);
    kit.cyl(MAT.wall, 0.62, 0.62, 0.05, [0, F + 0.76, 0.2], [0, 0, 0], 24);
    for (const a of [0.6, 2.7, 4.6]) kit.cyl(MAT.fabric, 0.2, 0.17, 0.46, [Math.sin(a) * 1.05, F + 0.23, 0.2 + Math.cos(a) * 1.05]);
    kit.box(MAT.hullDark, 0.6, 0.5, 0.6, [1.2, TOP + 1.3, 0.8]);
    kit.box(MAT.hullDark, 0.9, 0.35, 0.5, [-1.0, TOP + 1.22, -0.6]);
  },
  hydro(kit) {
    // Planting racks in the four corners, under violet grow-lights.
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const rack = new Kit();
      for (const y of [0.55, 1.45]) {
        rack.box(MAT.hullDark, 2.1, 0.22, 0.62, [0, y, 0]);
        rack.box(MAT.soil, 2.0, 0.04, 0.52, [0, y + 0.12, 0]);
        rack.box(MAT.lampGrow, 1.9, 0.03, 0.1, [0, y + 0.78, 0]);
        rack.box(MAT.frame, 2.1, 0.04, 0.2, [0, y + 0.81, 0]);
        for (let k = 0; k < 7; k++) {
          const x = -0.84 + k * 0.28, h = 0.18 + ((k * 7 + sx * 3 + sz * 5 + y * 10) % 5) * 0.045;
          rack.add(MAT.leaf, new THREE.SphereGeometry(0.13, 7, 5).scale(1, h / 0.13, 1), [x, y + 0.14 + h * 0.8, ((k % 2) - 0.5) * 0.16]);
        }
      }
      for (const x of [-1.02, 1.02]) rack.box(MAT.frame, 0.05, 2.4, 0.6, [x, 1.2, 0]);
      kit.merge(rack, [sx * 2.25, F, sz * 2.25], Math.atan2(sx, sz));
    }
    // A small tree in the middle: the one living thing the crew gets to sit under.
    kit.cyl(MAT.hullDark, 0.75, 0.68, 0.5, [0, F + 0.25, 0], [0, 0, 0], 20);
    kit.cyl(MAT.soil, 0.68, 0.68, 0.02, [0, F + 0.51, 0], [0, 0, 0], 20);
    kit.cyl(MAT.soil, 0.05, 0.09, 1.3, [0, F + 1.15, 0], [0.06, 0, 0.05]);
    for (const [x, y, z, r] of [[0, 2.1, 0, 0.55], [0.3, 1.85, 0.2, 0.36], [-0.28, 1.9, -0.15, 0.38], [0.05, 2.45, -0.1, 0.34]]) kit.ball(MAT.leaf, r, [x, F + y, z], [1, 0.8, 1]);
  },
  oxygen(kit, extras) {
    for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2]]) {
      kit.cyl(MAT.steel, 0.62, 0.62, 2.0, [x, F + 1.2, z], [0, 0, 0], 20);
      kit.ball(MAT.steel, 0.62, [x, F + 2.2, z], [1, 0.5, 1]);
      kit.cyl(MAT.hullDark, 0.68, 0.68, 0.2, [x, F + 0.1, z], [0, 0, 0], 20);
      kit.add(MAT.paint, new THREE.CylinderGeometry(0.63, 0.63, 0.16, 20), [x, F + 1.6, z]);
      kit.beam(MAT.steel, [x, F + 2.5, z], [x, TOP - 0.05, z], 0.07);
      kit.beam(MAT.steel, [x, F + 0.5, z], [x * 0.3, F + 0.5, z * 0.3 + 0.2], 0.06);
    }
    // The electrolysis unit in the middle, with a status display.
    kit.box(MAT.hullDark, 1.0, 1.2, 0.9, [0, F + 0.6, 0]);
    kit.box(MAT.frame, 1.06, 0.06, 0.96, [0, F + 1.23, 0]);
    kit.cyl(MAT.steel, 0.12, 0.12, TOP - F - 1.3, [0, (TOP + F + 1.2) / 2, 0]);
    kit.box(MAT.lampCool, 0.5, 0.06, 0.02, [0, F + 0.95, 0.46]);
    kit.box(MAT.lampCool, 0.5, 0.06, 0.02, [0, F + 0.8, 0.46]);
    // Roof: exhaust stacks.
    for (const [x, z] of [[-0.8, 0.5], [0.2, -0.7], [0.9, 0.6]]) {
      kit.cyl(MAT.steel, 0.24, 0.28, 1.5, [x, TOP + 1.7, z]);
      kit.cyl(MAT.frame, 0.3, 0.3, 0.1, [x, TOP + 2.45, z]);
    }
    void extras;
  },
  storage(kit) {
    const stack = (x, z, turn, list) => {
      const s = new Kit();
      for (const [material, w, h, d, px, py, pz, r] of list) s.box(material, w, h, d, [px, py + h / 2, pz], [0, r ?? 0, 0]);
      kit.merge(s, [x, F, z], turn);
    };
    stack(-2.2, -2.2, 0.78, [[MAT.crate, 1.1, 0.8, 1.1, 0, 0, 0], [MAT.crateSand, 1.0, 0.7, 1.0, 0.05, 0.8, 0, 0.2], [MAT.crate, 0.7, 0.5, 0.7, -0.1, 1.5, 0.1, -0.3]]);
    stack(2.2, -2.2, -0.78, [[MAT.crateSand, 1.2, 0.9, 1.2, 0, 0, 0], [MAT.crate, 0.9, 0.6, 0.9, 0, 0.9, 0.05, 0.4]]);
    stack(-2.3, 2.2, 2.3, [[MAT.crate, 1.0, 1.0, 1.0, 0, 0, 0], [MAT.crate, 0.6, 0.45, 0.6, 0.9, 0, 0.2, 0.5]]);
    stack(2.2, 2.3, -2.3, [[MAT.steel, 0.5, 1.3, 0.5, 0, 0, 0], [MAT.steel, 0.5, 1.3, 0.5, 0.6, 0, 0.1], [MAT.crateSand, 0.8, 0.5, 0.6, 0.2, 0, -0.75, 0.2]]);
    kit.box(MAT.hullDark, 2.2, 0.3, 1.4, [0, TOP + 1.2, 0]);
    kit.box(MAT.frame, 0.2, 0.5, 2.6, [-0.7, TOP + 1.1, 0]);
    kit.box(MAT.frame, 0.2, 0.5, 2.6, [0.7, TOP + 1.1, 0]);
  },
};

// ---------------------------------------------------------------- outdoor machines

function pad(kit) {
  octagon(kit, MAT.concrete, A + 0.5, A + 0.62, 0.6, F - 0.3);
  octagon(kit, MAT.hullDark, A + 0.56, A + 0.56, 0.08, F - 0.1);
}

const machines = {
  solar(kit) {
    pad(kit);
    for (const x of [-2.1, 2.1]) {
      for (const z of [-2.6, 0, 2.6]) {
        kit.cyl(MAT.steel, 0.09, 0.12, 1.5, [x, F + 0.75, z]);
        kit.box(MAT.frame, 0.3, 0.2, 0.3, [x, F + 1.5, z]);
        const panel = new Kit();
        panel.box(MAT.frame, 3.4, 0.07, 2.3, [0, 0, 0]);
        panel.add(MAT.solar, new THREE.BoxGeometry(3.3, 0.02, 2.2), [0, 0.045, 0], [0, 0, 0], true);
        for (const [material, list] of panel.parts) {
          for (const g of list) kit.add(material, g, [x, F + 1.72, z], [0, 0, 0.5], true);
        }
      }
      kit.beam(MAT.steel, [x, F + 1.5, -2.9], [x, F + 1.5, 2.9], 0.06);
    }
    kit.box(MAT.hullDark, 0.7, 0.9, 0.5, [0, F + 0.45, 3.4]);
    kit.box(MAT.lampCool, 0.2, 0.05, 0.02, [0, F + 0.7, 3.66]);
    kit.beam(MAT.rubber, [-2.1, F + 0.05, 2.6], [0, F + 0.05, 3.3], 0.05);
    kit.beam(MAT.rubber, [2.1, F + 0.05, 2.6], [0, F + 0.05, 3.3], 0.05);
  },
  mine(kit, extras) {
    pad(kit);
    const top = 9.2;
    const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const at = (k, y) => {
      const w = 1.8 - (1.8 - 0.55) * ((y - F) / (top - F));
      return [legs[k][0] * w, y, legs[k][1] * w];
    };
    for (let k = 0; k < 4; k++) {
      kit.beam(MAT.hullDark, at(k, F), at(k, top), 0.09);
      for (let level = 0; level < 4; level++) {
        const y0 = F + 0.3 + level * 2.15, y1 = y0 + 2.15;
        kit.beam(MAT.steel, at(k, y0), at((k + 1) % 4, y0), 0.045);
        kit.beam(MAT.steel, at(k, y0), at((k + 1) % 4, Math.min(y1, top)), 0.035);
      }
    }
    kit.box(MAT.hullDark, 1.5, 0.25, 1.5, [0, top + 0.1, 0]);
    kit.box(MAT.frame, 0.6, 0.6, 0.6, [0, top + 0.5, 0]);
    kit.cyl(MAT.hullDark, 0.75, 0.9, 0.5, [0, F + 0.25, 0], [0, 0, 0], 20);
    // machinery house, ore chute and a pile of what has been dug up
    kit.box(MAT.hull, 2.0, 1.7, 1.7, [2.8, F + 0.85, -1.9]);
    kit.box(MAT.hullDark, 2.1, 0.12, 1.8, [2.8, F + 1.76, -1.9]);
    kit.box(MAT.paint, 2.02, 0.14, 1.72, [2.8, F + 0.5, -1.9]);
    kit.cyl(MAT.steel, 0.12, 0.12, 1.4, [3.4, F + 2.4, -2.3]);
    kit.box(MAT.hullDark, 0.7, 0.16, 3.0, [-1.9, F + 1.3, 1.9], [0.5, 0.8, 0]);
    kit.add(MAT.concrete, new THREE.ConeGeometry(1.25, 1.1, 9), [-3.0, F + 0.55, 2.9]);
    // the drill string turns
    const drill = new Kit();
    drill.cyl(MAT.steel, 0.13, 0.13, top - F - 0.4, [0, (top + F) / 2, 0], [0, 0, 0], 10);
    for (let y = F + 1; y < top - 0.5; y += 1.5) drill.box(MAT.frame, 0.4, 0.22, 0.28, [0, y, 0]);
    const spinner = drill.build();
    spinner.userData.spin = 2.2;
    extras.push(spinner);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), MAT.lampAmber.clone());
    beacon.position.set(0, top + 0.95, 0);
    beacon.userData.blink = 1.1;
    extras.push(beacon);
  },
  shipyard(kit, extras) {
    pad(kit);
    const paint = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: padTexture(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    paint.position.y = F + 0.006;
    paint.receiveShadow = true;
    extras.push(paint);
    // control cabin
    kit.box(MAT.hull, 2.6, 1.3, 2.6, [-2.3, F + 0.65, -2.3]);
    kit.box(MAT.glass, 2.5, 0.9, 2.5, [-2.3, F + 1.75, -2.3]);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kit.box(MAT.frame, 0.14, 0.95, 0.14, [-2.3 + x * 1.24, F + 1.76, -2.3 + z * 1.24]);
    kit.box(MAT.hullDark, 2.9, 0.22, 2.9, [-2.3, F + 2.32, -2.3]);
    kit.cyl(MAT.steel, 0.03, 0.04, 2.6, [-3.2, F + 3.7, -3.2]);
    kit.box(MAT.paint, 2.62, 0.14, 2.62, [-2.3, F + 0.5, -2.3]);
    console_(kit, -1.55, -1.55, 'SHIPYARD', '#9ad0d6', 21, extras);
    // assembly gantry
    for (const x of [-3.2, 3.2]) {
      kit.box(MAT.hullDark, 0.4, 7.2, 0.4, [x, F + 3.6, 3.2]);
      kit.box(MAT.paint, 0.42, 0.5, 0.42, [x, F + 0.6, 3.2]);
    }
    kit.box(MAT.hullDark, 7.2, 0.45, 0.5, [0, F + 7.3, 3.2]);
    kit.box(MAT.frame, 0.6, 0.4, 0.7, [0.8, F + 6.95, 3.2]);
    kit.beam(MAT.steel, [0.8, F + 6.8, 3.2], [0.8, F + 4.6, 3.2], 0.03);
    kit.box(MAT.frame, 0.3, 0.3, 0.3, [0.8, F + 4.5, 3.2]);
    for (const x of [-2.6, 2.6]) {
      kit.box(MAT.frame, 0.5, 0.3, 0.3, [x, F + 6.95, 3.0], [0.5, 0, 0]);
      kit.box(MAT.lampCool, 0.4, 0.2, 0.03, [x, F + 6.87, 2.84], [0.5, 0, 0]);
    }
  },
};

// ---------------------------------------------------------------- public builders

/**
 * Build one module. `room` comes from planBase().
 * @returns { group, extras } — extras are the few parts that move (drills, beacons, holograms).
 */
export function buildModule(room) {
  const kit = new Kit(), extras = [];
  if (room.enterable) {
    shell(kit, room.sides, { glassRoof: room.type === 'hydro' });
    fittings[room.type](kit, extras);
  } else {
    machines[room.type](kit, extras);
  }
  const group = kit.build();

  // A stencilled name plate by the south-east corner.
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: labelTexture(`${CODES[room.type]}-${String(room.id).padStart(2, '0')}`), roughness: 0.7 }));
  if (room.enterable) {
    const a = Math.PI / 4;
    plate.position.set(Math.sin(a) * (A + T / 2 + 0.012), F + 2.75, Math.cos(a) * (A + T / 2 + 0.012));
    plate.rotation.y = a;
    group.add(plate);
  }
  for (const extra of extras) group.add(extra);
  group.position.set(room.x, 0, room.z);
  return { group, extras };
}

/** The short corridor between two rooms. Runs along z; turn it for x. */
function tube(kit, length, { roofLight = true } = {}) {
  const w = 1.9, h = DOOR_H + 0.25;
  kit.box(MAT.concrete, w + 0.3, 0.5, length, [0, F - 0.25, 0]);
  kit.box(MAT.deck, w - 0.2, 0.03, length, [0, F + 0.012, 0]);
  for (const s of [-1, 1]) {
    kit.box(MAT.hull, 0.2, h, length, [s * 0.95, F + h / 2, 0]);
    kit.box(MAT.wall, 0.04, h - 0.1, length - 0.1, [s * 0.83, F + h / 2, 0]);
    kit.beam(MAT.steel, [s * 1.1, F + 0.5, -length / 2], [s * 1.1, F + 0.5, length / 2], 0.06);
  }
  kit.box(MAT.hull, w + 0.2, 0.2, length, [0, F + h + 0.1, 0]);
  for (const z of [-length / 2 + 0.25, 0, length / 2 - 0.25]) {
    kit.box(MAT.hullDark, w + 0.44, 0.12, 0.16, [0, F + h + 0.24, z]);
    for (const s of [-1, 1]) kit.box(MAT.hullDark, 0.12, h + 0.3, 0.16, [s * 1.1, F + h / 2 + 0.1, z]);
  }
  if (roofLight) kit.box(MAT.lampWarm, 0.14, 0.03, length * 0.55, [0, F + h - 0.02, 0]);
}

export function buildConnector(c) {
  const kit = new Kit();
  tube(kit, GAP + 0.12);
  const group = kit.build();
  group.position.set(c.x, 0, c.z);
  if (c.alongX) group.rotation.y = Math.PI / 2;
  return group;
}

/** The way outside: a vestibule with a sliding outer door and a ramp. Returns { group, door }. */
export function buildAirlock(a) {
  const kit = new Kit();
  tube(kit, GAP + 0.12, { roofLight: false });
  const end = GAP / 2;
  // outer frame with hazard paint, and the ramp down to the ground
  for (const s of [-1, 1]) kit.box(MAT.paint, 0.26, DOOR_H + 0.4, 0.2, [s * 0.92, F + (DOOR_H + 0.4) / 2, end + 0.06]);
  kit.box(MAT.paint, 2.1, 0.26, 0.2, [0, F + DOOR_H + 0.38, end + 0.06]);
  kit.box(MAT.lampCool, 0.9, 0.07, 0.05, [0, F + DOOR_H + 0.2, end + 0.18]);
  kit.box(MAT.lampCool, 0.1, 0.03, 0.9, [0, F + DOOR_H + 0.22, 0]);
  kit.box(MAT.deck, 1.7, 0.06, 1.56, [0, F / 2 - 0.02, end + 0.75], [Math.atan2(F, 1.5), 0, 0]);
  // tall housing the outer door slides up into, with a beacon on top
  kit.box(MAT.hullDark, 1.95, DOOR_H + 0.3, 0.36, [0, F + DOOR_H * 1.5 + 0.6, end - 0.12]);
  kit.box(MAT.frame, 2.1, 0.1, 0.5, [0, F + DOOR_H * 2 + 0.8, end - 0.12]);
  kit.cyl(MAT.lampAmber, 0.07, 0.07, 0.12, [0.7, F + DOOR_H * 2 + 0.9, end - 0.12], [0, 0, 0], 10);
  for (const s of [-1, 1]) kit.beam(MAT.steel, [s * 0.85, F + 0.9, end + 0.1], [s * 0.85, 0.75, end + 1.5], 0.03);
  for (const s of [-1, 1]) kit.beam(MAT.steel, [s * 0.85, 0.75, end + 1.5], [s * 0.85, 0, end + 1.5], 0.03);
  const group = kit.build();

  const doorKit = new Kit();
  doorKit.box(MAT.hullDark, 1.62, DOOR_H + 0.05, 0.09, [0, 0, 0]);
  doorKit.box(MAT.paint, 1.62, 0.2, 0.1, [0, -0.5, 0]);
  doorKit.box(MAT.glass, 0.7, 0.5, 0.11, [0, 0.45, 0]);
  const door = doorKit.build();
  door.position.set(0, F + DOOR_H / 2, end - 0.12);
  group.add(door);

  group.position.set(a.x, 0, a.z);
  group.rotation.y = Math.atan2(a.nx, a.nz);
  return { group, door };
}

/** A cable run on the ground between a machine and its neighbour. */
export function buildConduit(c) {
  const kit = new Kit();
  const dx = c.bx - c.ax, dz = c.bz - c.az, len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len, a = A + 0.3;
  for (const off of [-0.25, 0.25]) {
    kit.beam(MAT.rubber, [c.ax + ux * a - uz * off, F - 0.05, c.az + uz * a + ux * off], [c.bx - ux * a - uz * off, F - 0.05, c.bz - uz * a + ux * off], 0.07);
  }
  kit.box(MAT.hullDark, 0.9, 0.24, 0.5, [(c.ax + c.bx) / 2, 0.12, (c.az + c.bz) / 2], [0, Math.atan2(ux, uz), 0]);
  return kit.build();
}

/** Simple outline of a module, used as the "blueprint" while placing one. */
export function buildGhost(material) {
  const kit = new Kit();
  kit.add(material, new THREE.CylinderGeometry(corner(A), corner(A), H + 0.4, 8, 1, false).rotateY(OCT), [0, F + H / 2, 0]);
  kit.add(material, new THREE.CylinderGeometry(corner(A + 0.5), corner(A + 0.5), 0.2, 8).rotateY(OCT), [0, 0.1, 0]);
  return kit.build({ shadows: false });
}
