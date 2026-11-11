// The commander: a suited astronaut built from simple parts on a jointed skeleton,
// animated in code (idle, walk, run, jump) so no model or animation files are needed.

import * as THREE from 'three';
import { TEX } from '../world/textures.js';

export function createAstronaut() {
  const weave = TEX.ground.normalMap.clone();
  weave.repeat.set(3, 3);
  const suit = new THREE.MeshStandardMaterial({ color: '#d2cfc6', roughness: 0.84, normalMap: weave, normalScale: new THREE.Vector2(0.3, 0.3) });
  const grey = new THREE.MeshStandardMaterial({ color: '#5d6168', roughness: 0.7, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.75 });
  const metal = new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.3, metalness: 0.95 });
  const stripe = new THREE.MeshStandardMaterial({ color: '#b35c22', roughness: 0.65 });
  const visor = new THREE.MeshStandardMaterial({ color: '#d2a45a', roughness: 0.1, metalness: 1, envMapIntensity: 3.2, emissive: '#3a2710', emissiveIntensity: 0.6 });
  const lens = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#dff1ff', emissiveIntensity: 4 });
  const status = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#6fe0a0', emissiveIntensity: 3 });

  const joint = (parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const part = (parent, geometry, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
  const ball = (r, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 18, 12).scale(sx, sy, sz);
  const ring = (r, tube) => new THREE.TorusGeometry(r, tube, 8, 22).rotateX(Math.PI / 2);

  const root = new THREE.Group();
  const hips = joint(root, 0, 0.92, 0);
  part(hips, ball(0.2, 1, 0.72, 0.8), grey);

  // --- torso ---
  const spine = joint(hips, 0, 0.04, 0);
  part(spine, capsule(0.19, 0.2).scale(1.14, 1, 0.86), suit, 0, 0.3, 0);
  part(spine, ring(0.185, 0.03).scale(1.1, 1, 0.84), dark, 0, 0.1, 0);
  part(spine, new THREE.BoxGeometry(0.24, 0.17, 0.08), grey, 0, 0.34, 0.165);
  part(spine, new THREE.BoxGeometry(0.05, 0.03, 0.02), status, -0.06, 0.38, 0.21);
  part(spine, new THREE.BoxGeometry(0.09, 0.03, 0.02), dark, 0.05, 0.38, 0.21);
  part(spine, new THREE.BoxGeometry(0.2, 0.02, 0.02), stripe, 0, 0.29, 0.21);
  // life-support backpack
  part(spine, new THREE.BoxGeometry(0.36, 0.5, 0.2), suit, 0, 0.34, -0.25);
  part(spine, new THREE.BoxGeometry(0.38, 0.06, 0.22), grey, 0, 0.56, -0.25);
  part(spine, new THREE.BoxGeometry(0.26, 0.05, 0.02), grey, 0, 0.44, -0.355);
  part(spine, new THREE.BoxGeometry(0.26, 0.05, 0.02), grey, 0, 0.34, -0.355);
  part(spine, new THREE.BoxGeometry(0.1, 0.1, 0.03), dark, 0, 0.2, -0.355);
  part(spine, new THREE.BoxGeometry(0.05, 0.02, 0.02), status, 0, 0.2, -0.372);
  for (const x of [-0.215, 0.215]) part(spine, new THREE.CylinderGeometry(0.05, 0.05, 0.42, 12), metal, x, 0.32, -0.25);
  part(spine, new THREE.CylinderGeometry(0.006, 0.006, 0.34, 6), dark, 0.14, 0.76, -0.3);
  part(spine, ring(0.15, 0.034), metal, 0, 0.56, 0.0);

  // --- head ---
  const head = joint(spine, 0, 0.75, 0.01);
  part(head, ball(0.225), suit);
  part(head, ball(0.19, 1.02, 0.86, 1), visor, 0, 0.0, 0.062);
  part(head, ring(0.2, 0.02).rotateX(Math.PI / 2).scale(1.0, 0.86, 1), grey, 0, 0, 0.12);
  part(head, new THREE.BoxGeometry(0.06, 0.06, 0.1), grey, 0.215, 0.07, 0.04);
  part(head, new THREE.CylinderGeometry(0.022, 0.022, 0.012, 12).rotateX(Math.PI / 2), lens, 0.215, 0.07, 0.096);

  // Helmet lamp: lights whatever the commander faces.
  const lamp = new THREE.SpotLight('#dcebff', 0, 34, 0.62, 0.7, 1.4);
  lamp.position.set(0.2, 0.08, 0.1);
  lamp.target.position.set(0.2, -0.75, 6);
  head.add(lamp, lamp.target);

  // --- arms ---
  const arm = (side) => {
    const shoulder = joint(spine, side * 0.27, 0.5, 0);
    part(shoulder, ball(0.105), suit);
    part(shoulder, capsule(0.075, 0.2), suit, 0, -0.17, 0);
    part(shoulder, new THREE.CylinderGeometry(0.079, 0.079, 0.045, 14), stripe, 0, -0.14, 0);
    const elbow = joint(shoulder, 0, -0.31, 0);
    part(elbow, ball(0.078), dark);
    part(elbow, capsule(0.068, 0.17), suit, 0, -0.15, 0);
    part(elbow, ring(0.07, 0.016), metal, 0, -0.255, 0);
    part(elbow, ball(0.075, 0.9, 1.15, 1), grey, 0, -0.33, 0);
    return { shoulder, elbow };
  };
  const armL = arm(1), armR = arm(-1);

  // --- legs ---
  const leg = (side) => {
    const hip = joint(hips, side * 0.125, -0.02, 0);
    part(hip, capsule(0.1, 0.24), suit, 0, -0.2, 0);
    part(hip, new THREE.CylinderGeometry(0.104, 0.104, 0.045, 14), stripe, 0, -0.3, 0);
    const knee = joint(hip, 0, -0.42, 0);
    part(knee, ball(0.098, 1, 1, 1.1), grey);
    part(knee, capsule(0.085, 0.2), suit, 0, -0.2, 0);
    part(knee, capsule(0.075, 0.12).rotateX(Math.PI / 2).scale(1.05, 0.8, 1), grey, 0, -0.44, 0.05);
    part(knee, new THREE.BoxGeometry(0.15, 0.03, 0.27), dark, 0, -0.492, 0.05);
    part(knee, ring(0.088, 0.018), metal, 0, -0.33, 0);
    return { hip, knee };
  };
  const legL = leg(1), legR = leg(-1);

  let phase = 0; // where we are in the walk cycle
  let blend = 0; // 0 = standing, 1 = full stride
  let air = 0; // 0 = on the ground, 1 = in the air
  let lastStep = 0;

  /**
   * @param speed    horizontal speed in m/s
   * @param onGround false while jumping or falling
   * @returns true on the frames a foot hits the ground (for footstep sound and dust)
   */
  function update(dt, time, speed, onGround) {
    const stride = Math.min(1, speed / 6.4);
    blend += (Math.min(1, speed / 1.2) - blend) * Math.min(1, dt * 9);
    air += ((onGround ? 0 : 1) - air) * Math.min(1, dt * 10);
    phase += dt * (3.2 + stride * 6.2) * (speed > 0.15 ? 1 : 0);

    const swing = (0.42 + stride * 0.45) * blend * (1 - air * 0.6);
    const s = Math.sin(phase), c = Math.cos(phase);
    const breathe = Math.sin(time * 1.6);

    legL.hip.rotation.x = -s * swing - air * 0.35;
    legR.hip.rotation.x = s * swing - air * 0.15;
    legL.knee.rotation.x = Math.max(0, c) * swing * 1.5 + 0.06 + air * 0.7;
    legR.knee.rotation.x = Math.max(0, -c) * swing * 1.5 + 0.06 + air * 0.4;

    armL.shoulder.rotation.x = s * swing * 0.8;
    armR.shoulder.rotation.x = -s * swing * 0.8;
    armL.shoulder.rotation.z = 0.1 + air * 0.5 + breathe * 0.008;
    armR.shoulder.rotation.z = -0.1 - air * 0.5 - breathe * 0.008;
    armL.elbow.rotation.x = -(0.22 + blend * 0.35 + Math.max(0, s) * swing * 0.5);
    armR.elbow.rotation.x = -(0.22 + blend * 0.35 + Math.max(0, -s) * swing * 0.5);

    hips.position.y = 0.92 - Math.abs(s) * 0.035 * blend * (0.5 + stride) + breathe * 0.004;
    hips.rotation.y = s * 0.12 * swing;
    spine.rotation.x = 0.03 + stride * 0.16 * blend;
    spine.rotation.y = -s * 0.2 * swing;
    spine.rotation.z = c * 0.03 * swing;
    spine.scale.setScalar(1 + breathe * 0.006);
    head.rotation.y = s * 0.1 * swing;

    // A foot lands twice per cycle.
    const step = Math.floor(phase / Math.PI);
    const landed = step !== lastStep && onGround && blend > 0.5;
    lastStep = step;
    return landed;
  }

  return { root, head, lamp, update };
}
