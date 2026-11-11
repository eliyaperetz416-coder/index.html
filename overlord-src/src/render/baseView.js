// Draws the base from the game state, and handles pointing at the build grid.

import * as THREE from 'three';
import { GRID_RADIUS } from '../data/modules.js';
import { canPlace } from '../sim/state.js';
import { createModuleMesh, createCorridor, animateModule } from './moduleMeshes.js';

/** Distance between the centres of two neighbouring grid cells. */
export const CELL = 4.4;
const PAD = 1.7; // radius of a module's landing pad

export function createBaseView({ scene, camera }) {
  const modules = new THREE.Group(); // one child per module in the state
  const corridors = new THREE.Group();
  const slots = new THREE.Group(); // markers on cells where you can build
  scene.add(modules, corridors, slots);

  const slotGeo = new THREE.RingGeometry(1.2, 1.4, 8).rotateX(-Math.PI / 2).rotateY(Math.PI / 8);
  const slotMat = new THREE.MeshBasicMaterial({ color: '#39e0ff', transparent: true, opacity: 0.5 });

  let ghost = null; // see-through preview of the module being placed
  const ghostOk = new THREE.MeshBasicMaterial({ color: '#4dffb0', transparent: true, opacity: 0.45 });
  const ghostBad = new THREE.MeshBasicMaterial({ color: '#ff4d6a', transparent: true, opacity: 0.45 });

  /** Rebuild meshes to match the state. Cheap enough to call after every change. */
  function sync(state) {
    const seen = new Set();
    for (const m of state.modules) {
      seen.add(m.id);
      if (modules.children.some((c) => c.userData.id === m.id)) continue;
      const mesh = createModuleMesh(m.type);
      mesh.userData.id = m.id;
      mesh.userData.born = performance.now();
      mesh.position.set(m.x * CELL, 0, m.z * CELL);
      modules.add(mesh);
    }
    for (const c of [...modules.children]) if (!seen.has(c.userData.id)) modules.remove(c);

    corridors.clear();
    for (const a of state.modules) {
      for (const b of state.modules) {
        const right = b.x === a.x + 1 && b.z === a.z;
        const down = b.z === a.z + 1 && b.x === a.x;
        if (!right && !down) continue;
        const tube = createCorridor(CELL - PAD * 2 + 0.3);
        tube.position.set(((a.x + b.x) / 2) * CELL, 0, ((a.z + b.z) / 2) * CELL);
        if (down) tube.rotation.y = Math.PI / 2;
        corridors.add(tube);
      }
    }
  }

  /** Show (or hide, with type = null) the cells where `type` could be built. */
  function showSlots(state, type) {
    slots.clear();
    if (!type) return;
    for (let x = -GRID_RADIUS; x <= GRID_RADIUS; x++) {
      for (let z = -GRID_RADIUS; z <= GRID_RADIUS; z++) {
        const check = canPlace(state, type, x, z);
        if (!check.ok && check.reason !== 'Not enough resources') continue;
        const marker = new THREE.Mesh(slotGeo, slotMat);
        marker.position.set(x * CELL, 0.05, z * CELL);
        slots.add(marker);
      }
    }
  }

  function setGhost(type) {
    if (ghost) scene.remove(ghost);
    ghost = null;
    if (!type) return;
    ghost = createModuleMesh(type);
    ghost.visible = false;
    scene.add(ghost);
  }

  function moveGhost(cell, ok) {
    if (!ghost) return;
    ghost.visible = !!cell;
    if (!cell) return;
    ghost.position.set(cell.x * CELL, 0, cell.z * CELL);
    ghost.traverse((o) => {
      if (o.isMesh) o.material = ok ? ghostOk : ghostBad;
    });
  }

  // Turn a screen position into a grid cell by shooting a ray at the ground.
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  function cellAt(clientX, clientY) {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(ground, hit)) return null;
    return { x: Math.round(hit.x / CELL), z: Math.round(hit.z / CELL) };
  }

  function update(time, dt) {
    const now = performance.now();
    for (const m of modules.children) {
      animateModule(m, time, dt);
      // New modules pop up out of the ground.
      const age = Math.min(1, (now - m.userData.born) / 350);
      m.scale.setScalar(0.3 + 0.7 * (1 - (1 - age) ** 3));
    }
    slotMat.opacity = 0.35 + 0.2 * Math.sin(time * 4);
  }

  return { sync, showSlots, setGhost, moveGhost, cellAt, update };
}
