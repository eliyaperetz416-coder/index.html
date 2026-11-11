// Puts the base into the 3D world from the game state, and keeps the moving parts moving:
// doors, drills, beacons, room lights, and the blueprint shown while building.

import * as THREE from 'three';
import { planBase, buildColliders, CELL, FLOOR, DOOR_H, GAP } from './layout.js';
import { buildModule, buildConnector, buildAirlock, buildConduit, buildGhost, PROPS, TERMINALS } from './modules.js';
import { ghostMaterial, MAT } from '../world/materials.js';
import { Kit } from '../engine/kit.js';
import { GRID_RADIUS } from '../data/modules.js';

const ROOM_LIGHT = { core: '#ffe6cc', hydro: '#ffe9f6', oxygen: '#d9ecff' };
const LIGHTS = 6; // rooms lit at once (the nearest ones); a fixed number keeps rendering fast

/** A faint cone of lit dust under a floodlight. */
function lightCone(height, radius, color) {
  const geo = new THREE.ConeGeometry(radius, height, 28, 1, true).translate(0, -height / 2, 0);
  return new THREE.Mesh(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { color: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN, vV;
      void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform vec3 color; varying vec2 vUv; varying vec3 vN, vV;
      void main() { float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); gl_FragColor = vec4(color * edge * pow(vUv.y, 2.2) * 0.22, 1.0); }`,
  }));
}

/** Floodlight masts, cargo and a comms mast: the things that were here before the first module. */
function siteDressing(scene) {
  const kit = new Kit();
  const lamps = [];
  for (const [x, z, tx, tz] of [[-30, 50, -8, 64], [30, 50, 8, 64]]) {
    kit.cyl(MAT.hullDark, 0.12, 0.2, 11, [x, 5.5, z], [0, 0, 0], 10);
    kit.box(MAT.concrete, 1.2, 0.4, 1.2, [x, 0.2, z]);
    kit.box(MAT.frame, 1.3, 0.5, 0.5, [x, 11.1, z]);
    kit.box(MAT.lampCool, 1.1, 0.34, 0.06, [x + Math.sign(tx - x) * 0.05, 10.95, z + 0.27]);
    const spot = new THREE.SpotLight('#cfe2ff', 520, 70, 0.6, 0.6, 1.6);
    spot.position.set(x, 11, z);
    spot.target.position.set(tx, 0, tz);
    const cone = lightCone(16, 8.5, '#9fc0ff');
    cone.position.set(x, 11, z + 0.3);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(tx - x, -11, tz - z).normalize());
    scene.add(spot, spot.target, cone);
    lamps.push(spot);
  }
  // cargo dropped beside the lander
  const crates = [[12, 52, 1.4, MAT.crate, 0.3], [13.8, 53.2, 1.1, MAT.crateSand, 1.1], [12.6, 53.9, 0.8, MAT.crate, 0.6], [27, 55, 1.5, MAT.crateSand, 0.2], [12.2, 52.2, 0.9, MAT.crateSand, 0.9]];
  crates.forEach(([x, z, s, material, turn], i) => kit.box(material, s, s * 0.8, s, [x, i === 4 ? 1.12 + 0.36 : s * 0.4, z], [0, turn, 0]));
  // survey beacon
  kit.cyl(MAT.steel, 0.04, 0.07, 6, [-14, 3, 44], [0, 0, 0], 8);
  kit.cyl(MAT.lampRed, 0.07, 0.07, 0.14, [-14, 6.05, 44], [0, 0, 0], 8);
  kit.box(MAT.hullDark, 0.6, 0.5, 0.6, [-14, 0.25, 44]);
  scene.add(kit.build());
  return { circles: [{ x: -30, z: 50, r: 0.7 }, { x: 30, z: 50, r: 0.7 }, { x: 12.8, z: 53, r: 1.7 }, { x: 27, z: 55, r: 1.1 }, { x: -14, z: 44, r: 0.5 }] };
}

export function createBaseView(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const site = siteDressing(scene);

  const roomLights = Array.from({ length: LIGHTS }, () => {
    const light = new THREE.PointLight('#ffd4a0', 0, 9.5, 1.5);
    scene.add(light);
    return light;
  });

  let plan = planBase([]);
  let colliders = { segments: [], circles: [] };
  let terminals = []; // [{ x, z, action, label }]
  let movers = []; // parts that spin or blink
  let door = null, doorWorld = null;
  let drawn = '';

  /** Rebuild the base if the list of modules changed. Returns true if it did. */
  function sync(state) {
    const signature = state.modules.map((m) => `${m.id}:${m.type}:${m.x}:${m.z}`).join('|');
    if (signature === drawn) return false;
    drawn = signature;

    root.traverse((o) => o.isMesh && o.geometry.dispose());
    root.clear();
    movers = [];
    plan = planBase(state.modules);
    for (const room of plan.rooms) {
      const { group, extras } = buildModule(room);
      root.add(group);
      movers.push(...extras.filter((e) => e.userData.spin || e.userData.blink));
    }
    for (const c of plan.connectors) root.add(buildConnector(c));
    for (const c of plan.conduits) root.add(buildConduit(c));
    door = doorWorld = null;
    if (plan.airlock) {
      const built = buildAirlock(plan.airlock);
      root.add(built.group);
      door = built.door;
      const a = plan.airlock;
      doorWorld = { x: a.x + a.nx * (GAP / 2), z: a.z + a.nz * (GAP / 2) };
    }

    colliders = buildColliders(plan, PROPS);
    colliders.circles.push(...site.circles);
    terminals = [];
    for (const room of plan.rooms) {
      for (const [x, z, action, label] of TERMINALS[room.type] ?? []) terminals.push({ x: room.x + x, z: room.z + z, action, label });
    }
    return true;
  }

  function update(dt, time, playerPos) {
    for (const m of movers) {
      if (m.userData.spin) m.rotation.y += m.userData.spin * dt;
      if (m.userData.blink) m.material.emissiveIntensity = (time * m.userData.blink) % 1 < 0.18 ? 5 : 0.05;
    }
    if (door) {
      const near = Math.hypot(playerPos.x - doorWorld.x, playerPos.z - doorWorld.z) < 3.6;
      const target = FLOOR + DOOR_H / 2 + (near ? DOOR_H + 0.25 : 0);
      door.position.y += (target - door.position.y) * Math.min(1, dt * 5);
    }
    // Light the rooms nearest the player.
    const rooms = plan.rooms.filter((r) => r.enterable)
      .map((r) => ({ r, d: (r.x - playerPos.x) ** 2 + (r.z - playerPos.z) ** 2 }))
      .sort((a, b) => a.d - b.d);
    roomLights.forEach((light, i) => {
      const room = rooms[i]?.r;
      light.intensity = room ? 20 : 0;
      if (room) {
        light.position.set(room.x, FLOOR + 2.55, room.z);
        light.color.set(ROOM_LIGHT[room.type] ?? '#ffd4a0');
      }
    });
  }

  /** True while the airlock door is (nearly) open — for the door sound. */
  const doorOpen = () => !!door && door.position.y > FLOOR + DOOR_H;

  // --- the blueprint shown while choosing where to build ---
  const ghosts = { true: buildGhost(ghostMaterial(true)), false: buildGhost(ghostMaterial(false)) };
  const marks = new THREE.Group();
  for (const g of Object.values(ghosts)) { g.visible = false; scene.add(g); }
  scene.add(marks);
  const markMaterial = new THREE.LineBasicMaterial({ color: '#6fd0d8', transparent: true, opacity: 0.35 });
  const markGeometry = new THREE.BufferGeometry().setFromPoints(
    [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, z]) => new THREE.Vector3(x * (CELL / 2 - 0.4), 0.06, z * (CELL / 2 - 0.4))),
  );

  /** Outline every cell where a module may go (cells = [{ x, z }]), or pass null to hide. */
  function showBuildCells(cells) {
    marks.clear();
    for (const c of cells ?? []) {
      const line = new THREE.Line(markGeometry, markMaterial);
      line.position.set(c.x * CELL, 0, c.z * CELL);
      marks.add(line);
    }
  }

  /** Show the blueprint on a cell (or hide it with cell = null). */
  function aimGhost(cell, ok) {
    ghosts.true.visible = !!cell && ok;
    ghosts.false.visible = !!cell && !ok;
    if (cell) for (const g of Object.values(ghosts)) g.position.set(cell.x * CELL, 0, cell.z * CELL);
  }

  return {
    sync, update, showBuildCells, aimGhost, doorOpen,
    get plan() { return plan; },
    get colliders() { return colliders; },
    get terminals() { return terminals; },
    gridLimit: GRID_RADIUS,
  };
}
