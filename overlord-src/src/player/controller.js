// Walking, jumping and the third-person camera.

import * as THREE from 'three';
import { createAstronaut } from './astronaut.js';
import { WORLD_RADIUS } from '../world/terrain.js';

const WALK = 3.3, RUN = 6.6, GRAVITY = 13, JUMP = 5.6;
export const PLAYER_RADIUS = 0.38;
const EYE = 1.62;

const angleLerp = (a, b, t) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;

/**
 * @param world  what the player can stand on and bump into:
 *   groundAt(x, z)          → height of the floor there
 *   collide(pos, radius)    → pushes pos out of walls and rocks
 *   cameraLimit(from, to)   → 0…1, how far the camera can pull back before hitting something
 */
export function createPlayer(scene, camera, world) {
  const body = createAstronaut();
  scene.add(body.root);

  const pos = new THREE.Vector3(0, 0, 0);
  const vel = new THREE.Vector3();
  let facing = Math.PI; // which way the body points
  let onGround = true;
  let camYaw = 0, camPitch = 0.16, camDist = 5.2, camPull = 1;
  let lampOn = false;
  const pivot = new THREE.Vector3(), offset = new THREE.Vector3(), want = new THREE.Vector3(), look = new THREE.Vector3();

  function place(x, z, faceYaw = Math.PI) {
    pos.set(x, world.groundAt(x, z), z);
    vel.set(0, 0, 0);
    facing = faceYaw;
    camYaw = faceYaw + Math.PI;
    body.root.position.copy(pos);
  }

  /** @returns { landedStep, jumped } for sound and dust */
  function update(dt, time, input) {
    // --- camera angles ---
    camYaw -= input.lookX;
    camPitch = Math.max(-0.55, Math.min(1.25, camPitch + input.lookY));
    camDist = Math.max(2.4, Math.min(11, camDist + input.zoom * 0.7));

    // --- horizontal movement, relative to where the camera looks ---
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const wishX = fx * input.moveY - fz * input.moveX;
    const wishZ = fz * input.moveY + fx * input.moveX;
    const push = Math.min(1, Math.hypot(input.moveX, input.moveY));
    const top = (input.run ? RUN : WALK) * push;
    const grip = (onGround ? 13 : 2.5) * dt;
    vel.x += (wishX * top - vel.x) * Math.min(1, grip);
    vel.z += (wishZ * top - vel.z) * Math.min(1, grip);
    if (push > 0.1) facing = angleLerp(facing, Math.atan2(wishX, wishZ), Math.min(1, dt * 11));

    const here = world.groundAt(pos.x, pos.z);
    const nx = pos.x + vel.x * dt, nz = pos.z + vel.z * dt;
    const there = world.groundAt(nx, nz);
    const stepLen = Math.hypot(nx - pos.x, nz - pos.z);
    const tooSteep = onGround && there - here > 0.3 && (there - here) / Math.max(stepLen, 1e-4) > 1.15;
    if (!tooSteep) {
      pos.x = nx;
      pos.z = nz;
    } else {
      vel.x = vel.z = 0;
    }
    world.collide(pos, PLAYER_RADIUS);
    const edge = Math.hypot(pos.x, pos.z);
    if (edge > WORLD_RADIUS) pos.multiplyScalar(WORLD_RADIUS / edge).setY(pos.y);

    // --- vertical: gravity, jumping, sticking to slopes ---
    let jumped = false;
    if (onGround && input.pressed.has('jump')) {
      vel.y = JUMP;
      onGround = false;
      jumped = true;
    }
    const ground = world.groundAt(pos.x, pos.z);
    if (onGround && pos.y - ground < 0.45) {
      pos.y += (ground - pos.y) * Math.min(1, dt * 18); // follow the ground, easing over small steps
      vel.y = 0;
    } else {
      vel.y -= GRAVITY * dt;
      pos.y += vel.y * dt;
      onGround = pos.y <= ground;
      if (onGround) pos.y = ground;
    }

    body.root.position.copy(pos);
    body.root.rotation.y = facing;
    const speed = Math.hypot(vel.x, vel.z);
    const landedStep = body.update(dt, time, speed, onGround);

    if (input.pressed.has('lamp')) lampOn = !lampOn;
    body.lamp.intensity += ((lampOn ? 60 : 0) - body.lamp.intensity) * Math.min(1, dt * 10);

    // --- camera: over the shoulder, pulled in by walls, ceilings and hills ---
    const cp = Math.cos(camPitch);
    offset.set(Math.sin(camYaw) * cp, Math.sin(camPitch), Math.cos(camYaw) * cp);
    const shoulder = Math.min(0.55, camDist * 0.1);
    pivot.set(pos.x + Math.cos(camYaw) * shoulder, pos.y + EYE, pos.z - Math.sin(camYaw) * shoulder);
    want.copy(pivot).addScaledVector(offset, camDist);
    const allowed = world.cameraLimit(pivot, want);
    camPull = allowed < camPull ? allowed : camPull + (allowed - camPull) * Math.min(1, dt * 4);
    camera.position.copy(pivot).addScaledVector(offset, camDist * camPull);
    camera.lookAt(look.copy(pivot).addScaledVector(offset, -4));
    body.root.visible = camDist * camPull > 1.25; // too close: see through the commander's eyes

    return { landedStep, jumped, speed, onGround };
  }

  return { pos, update, place, body, get facing() { return facing; }, get camYaw() { return camYaw; } };
}
