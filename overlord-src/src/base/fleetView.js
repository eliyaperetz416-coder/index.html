// The fleet on the landing field. Ships lift off when they leave on an expedition
// or for a battle, and come back down when they return.

import * as THREE from 'three';
import { buildShip, parkingSpot, SHIP_RADIUS, LANDER_SPOT } from './ships.js';
import { shipBusy } from '../sim/fleet.js';
import { TEX } from '../world/textures.js';

const CEILING = 700; // height at which a departing ship is out of sight

export function createFleetView(scene) {
  const lander = buildShip('lander');
  lander.position.set(LANDER_SPOT.x, 0, LANDER_SPOT.z);
  lander.rotation.y = LANDER_SPOT.yaw;
  scene.add(lander);
  const cabin = new THREE.PointLight('#ffd9a8', 14, 9, 1.6);
  cabin.position.set(LANDER_SPOT.x - Math.sin(LANDER_SPOT.yaw) * 3.2, 2.4, LANDER_SPOT.z - Math.cos(LANDER_SPOT.yaw) * 3.2);
  scene.add(cabin);

  const ships = new Map(); // ship id → { mesh, key, spot, alt, away, glow }
  const flame = new THREE.SpriteMaterial({ map: TEX.dot, color: new THREE.Color(4, 7, 12), blending: THREE.AdditiveBlending, depthWrite: false });

  function sync(state) {
    const alive = new Set(state.ships.map((s) => s.id));
    for (const [id, entry] of ships) {
      if (alive.has(id)) continue;
      scene.remove(entry.mesh);
      ships.delete(id);
    }
    const taken = new Set([...ships.values()].map((e) => e.spot));
    for (const ship of state.ships) {
      const away = !!shipBusy(state, ship.id);
      const key = `${ship.type}:${ship.level}`;
      let entry = ships.get(ship.id);
      if (!entry) {
        let spot = 0;
        while (taken.has(spot)) spot++;
        taken.add(spot);
        entry = { spot, alt: away ? CEILING : 0, key: '' };
        ships.set(ship.id, entry);
      }
      if (entry.key !== key) {
        if (entry.mesh) scene.remove(entry.mesh);
        entry.mesh = buildShip(ship.type, ship.level);
        entry.glow = new THREE.Sprite(flame);
        entry.glow.scale.setScalar(ship.type === 'frigate' ? 9 : 5);
        entry.glow.position.y = 0.6;
        entry.mesh.add(entry.glow);
        const p = parkingSpot(entry.spot);
        entry.mesh.position.set(p.x, 0, p.z);
        entry.mesh.rotation.y = p.yaw;
        entry.type = ship.type;
        entry.key = key;
        scene.add(entry.mesh);
      }
      entry.away = away;
    }
  }

  function update(dt) {
    for (const e of ships.values()) {
      const moving = e.away ? e.alt < CEILING : e.alt > 0;
      if (e.away) e.alt = Math.min(CEILING, e.alt + (1.2 + e.alt * 0.9) * dt);
      else e.alt = Math.max(0, e.alt - (1.5 + e.alt * 1.1) * dt);
      e.mesh.visible = e.alt < CEILING;
      e.mesh.position.y = e.alt;
      e.glow.visible = moving;
    }
  }

  /** Circles the player cannot walk through: the lander and every parked ship. */
  function colliders() {
    const out = [{ x: LANDER_SPOT.x, z: LANDER_SPOT.z, r: SHIP_RADIUS.lander }];
    for (const e of ships.values()) {
      if (e.alt < 3) out.push({ x: e.mesh.position.x, z: e.mesh.position.z, r: SHIP_RADIUS[e.type] });
    }
    return out;
  }

  return { sync, update, colliders };
}
