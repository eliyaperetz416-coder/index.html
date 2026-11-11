// Draws the fleet: finished ships patrol in a slow circle above the base.

import * as THREE from 'three';
import { SHIPS } from '../data/ships.js';

const hull = new THREE.MeshStandardMaterial({ color: '#59639c', roughness: 0.45, metalness: 0.6, flatShading: true });
const dark = new THREE.MeshStandardMaterial({ color: '#232848', roughness: 0.6, metalness: 0.6 });
const glow = (color, intensity = 2) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });

function part(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

// Ships are modelled with their nose pointing along +Z.
const builders = {
  scout(g, lit) {
    g.add(part(new THREE.ConeGeometry(0.35, 1.8, 6).rotateX(Math.PI / 2), hull));
    g.add(part(new THREE.BoxGeometry(1.7, 0.06, 0.55), dark, 0, 0, -0.45));
    g.add(part(new THREE.BoxGeometry(1.75, 0.03, 0.12), lit, 0, 0.05, -0.6));
    g.add(part(new THREE.SphereGeometry(0.2, 10, 8), lit, 0, 0, -0.95));
  },
  frigate(g, lit) {
    g.add(part(new THREE.BoxGeometry(0.8, 0.55, 2.8), hull));
    g.add(part(new THREE.ConeGeometry(0.45, 0.9, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), hull, 0, 0, 1.8));
    g.add(part(new THREE.BoxGeometry(0.5, 0.35, 0.8), dark, 0, 0.42, -0.4));
    for (const x of [-0.75, 0.75]) {
      g.add(part(new THREE.BoxGeometry(0.4, 0.4, 1.8), dark, x, -0.05, -0.4));
      g.add(part(new THREE.SphereGeometry(0.22, 10, 8), lit, x, -0.05, -1.35));
    }
    g.add(part(new THREE.BoxGeometry(0.84, 0.06, 2.2), lit, 0, 0.1, 0));
  },
};

function createShipMesh(ship) {
  const group = new THREE.Group();
  builders[ship.type](group, glow(SHIPS[ship.type].color));
  group.scale.setScalar(0.7 * (1 + 0.25 * (ship.level - 1))); // upgraded ships are visibly bigger
  return group;
}

export function createFleetView({ scene }) {
  const ships = new THREE.Group();
  scene.add(ships);
  const ahead = new THREE.Vector3();

  function sync(state) {
    // Ships away on an expedition are not drawn at the base.
    const home = state.ships.filter((s) => !state.expedition?.shipIds.includes(s.id));
    const wanted = new Map(home.map((s) => [`${s.id}:${s.level}`, s]));
    for (const c of [...ships.children]) {
      if (wanted.has(c.userData.key)) wanted.delete(c.userData.key);
      else ships.remove(c);
    }
    for (const [key, ship] of wanted) {
      const mesh = createShipMesh(ship);
      mesh.userData.key = key;
      mesh.userData.slot = ship.id;
      ships.add(mesh);
    }
  }

  const place = (target, slot, index, count, time) => {
    const angle = time * 0.18 + (index / Math.max(count, 1)) * Math.PI * 2;
    const radius = 7 + (slot % 3) * 1.6;
    target.set(Math.cos(angle) * radius, 8.5 + (slot % 2) * 1.4 + Math.sin(time + slot) * 0.3, Math.sin(angle) * radius);
  };

  function update(time) {
    const sorted = [...ships.children].sort((a, b) => a.userData.slot - b.userData.slot);
    sorted.forEach((mesh, i) => {
      place(mesh.position, mesh.userData.slot, i, sorted.length, time);
      place(ahead, mesh.userData.slot, i, sorted.length, time + 0.2);
      mesh.lookAt(ahead);
    });
  }

  return { sync, update };
}
