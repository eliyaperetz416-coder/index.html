// Builds the 3D model for each module type out of simple shapes (no model files needed yet).

import * as THREE from 'three';
import { MODULES } from '../data/modules.js';

const hull = new THREE.MeshStandardMaterial({ color: '#2b3157', roughness: 0.55, metalness: 0.6 });
const hullLight = new THREE.MeshStandardMaterial({ color: '#56609a', roughness: 0.5, metalness: 0.5 });

const glow = (color, intensity = 1.3) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

/** The part unique to each module type, sitting on top of the shared pad. */
const builders = {
  core(g, lit) {
    g.add(mesh(new THREE.CylinderGeometry(1.2, 1.5, 1.6, 8), hullLight, 0, 1.1));
    g.add(mesh(new THREE.SphereGeometry(1.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lit, 0, 1.9));
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2), hullLight, 0, 3.8));
    const beacon = mesh(new THREE.SphereGeometry(0.18), lit, 0, 4.9);
    beacon.userData.pulse = true;
    g.add(beacon);
  },
  solar(g, lit) {
    g.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.4), hullLight, 0, 1));
    const panels = new THREE.Group();
    panels.position.y = 1.8;
    panels.rotation.x = -0.5;
    for (const x of [-0.85, 0.85]) {
      panels.add(mesh(new THREE.BoxGeometry(1.5, 0.08, 2.2), hull, x, 0, 0));
      panels.add(mesh(new THREE.BoxGeometry(1.3, 0.02, 2.0), glow('#2f6bff', 1.2), x, 0.06, 0));
    }
    panels.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), lit));
    g.add(panels);
  },
  mine(g, lit) {
    g.add(mesh(new THREE.BoxGeometry(2, 1.1, 2), hullLight, 0, 0.85));
    g.add(mesh(new THREE.BoxGeometry(2.05, 0.12, 2.05), lit, 0, 1.0));
    const drill = mesh(new THREE.ConeGeometry(0.55, 1.6, 6), hull, 0, 2.2);
    drill.userData.spin = 3;
    g.add(drill);
  },
  oxygen(g, lit) {
    for (const [x, z] of [[-0.6, -0.5], [0.6, -0.5], [0, 0.6]]) {
      g.add(mesh(new THREE.CapsuleGeometry(0.5, 0.9, 6, 12), hullLight, x, 1.25, z));
      g.add(mesh(new THREE.TorusGeometry(0.52, 0.06, 8, 20).rotateX(Math.PI / 2), lit, x, 1.3, z));
    }
  },
  hydro(g, lit) {
    g.add(mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.4, 20), hullLight, 0, 0.5));
    g.add(mesh(new THREE.SphereGeometry(0.75, 12, 8), lit, 0, 0.9));
    const glass = new THREE.MeshStandardMaterial({ color: '#b8ffd0', transparent: true, opacity: 0.25, roughness: 0.1 });
    g.add(mesh(new THREE.SphereGeometry(1.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.7));
  },
  habitat(g, lit) {
    g.add(mesh(new THREE.CapsuleGeometry(0.85, 1.6, 8, 16).rotateZ(Math.PI / 2), hullLight, 0, 1.15));
    g.add(mesh(new THREE.BoxGeometry(1.7, 0.22, 1.76), lit, 0, 1.3));
  },
  storage(g, lit) {
    g.add(mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), hullLight, -0.6, 0.85, -0.5));
    g.add(mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), hullLight, 0.6, 0.85, 0.2));
    g.add(mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), hull, -0.1, 1.9, -0.1));
    g.add(mesh(new THREE.BoxGeometry(1.14, 0.1, 1.14), lit, -0.6, 1.0, -0.5));
    g.add(mesh(new THREE.BoxGeometry(1.14, 0.1, 1.14), lit, 0.6, 1.0, 0.2));
  },
  shipyard(g, lit) {
    g.add(mesh(new THREE.BoxGeometry(2.4, 0.3, 2.4), hullLight, 0, 0.45));
    for (const x of [-1.05, 1.05]) g.add(mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), hull, x, 1.6, 0));
    g.add(mesh(new THREE.BoxGeometry(2.35, 0.2, 0.3), hull, 0, 2.9, 0));
    // Spinning construction ring between the two pylons.
    const ring = mesh(new THREE.TorusGeometry(0.8, 0.07, 8, 24), lit, 0, 1.7);
    ring.userData.spin = 1.5;
    g.add(ring);
  },
};

export function createModuleMesh(type) {
  const group = new THREE.Group();
  const lit = glow(MODULES[type].color);
  // Shared landing pad with a glowing ring in the module's colour.
  group.add(mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.3, 8), hull, 0, 0.15));
  group.add(mesh(new THREE.TorusGeometry(1.72, 0.05, 8, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8), lit, 0, 0.32));
  builders[type](group, lit);
  return group;
}

/** Tube that links two neighbouring modules. `length` is the gap it has to span. */
export function createCorridor(length) {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, length, 10).rotateZ(Math.PI / 2), hull, 0, 0.45));
  group.add(mesh(new THREE.BoxGeometry(length * 0.6, 0.06, 0.3), glow('#8ad8ff', 1.5), 0, 0.85));
  return group;
}

/** Call every frame so drills spin and beacons pulse. */
export function animateModule(group, time, dt) {
  for (const child of group.children) {
    if (child.userData.spin) child.rotation.y += child.userData.spin * dt;
    if (child.userData.pulse) child.scale.setScalar(1 + 0.5 * Math.sin(time * 4));
  }
}
