// Walking collisions on several floors: boxes (walls, furniture) and circles (people).
// Each collider blocks only between its minY and maxY, so a wall on floor 2 does not block floor 1.
import * as THREE from 'three';

const BODY_LOW = 0.1;   // the player's body spans [y + 0.1, y + 1.6] for overlap tests
const BODY_HIGH = 1.6;

/** Collider empties are unit boxes scaled to half-extents (Blender Z → three.js Y). */
export function footprint(empty) {
  const p = empty.getWorldPosition(new THREE.Vector3());
  const s = empty.getWorldScale(new THREE.Vector3());
  return { minX: p.x - s.x, maxX: p.x + s.x, minY: p.y - s.y, maxY: p.y + s.y, minZ: p.z - s.z, maxZ: p.z + s.z };
}

function overlapsBody(c, y) {
  return c.maxY > y + BODY_LOW && c.minY < y + BODY_HIGH;
}

function pushOutOfCircle(p, c, radius) {
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  const d = Math.hypot(dx, dz);
  const min = c.r + radius;
  if (d >= min) return;
  if (d < 1e-6) { p.x += min; return; }
  p.x = c.x + (dx / d) * min;
  p.z = c.z + (dz / d) * min;
}

function pushOutOfBox(p, c, radius) {
  const cx = THREE.MathUtils.clamp(p.x, c.minX, c.maxX);
  const cz = THREE.MathUtils.clamp(p.z, c.minZ, c.maxZ);
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    p.x += (dx / d) * (radius - d);
    p.z += (dz / d) * (radius - d);
    return;
  }
  // Center is inside the box: leave through the nearest side.
  const exits = [
    [c.minX - radius - p.x, 0], [c.maxX + radius - p.x, 0],
    [0, c.minZ - radius - p.z], [0, c.maxZ + radius - p.z],
  ];
  exits.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
  p.x += exits[0][0];
  p.z += exits[0][1];
}

/** Pushes a circle at (p.x, p.z) out of every collider it overlaps on its floor (sliding along walls). */
export function resolveCollisions(p, colliders, radius = 0.2) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      if (!overlapsBody(c, p.y)) continue;
      if (c.r !== undefined) pushOutOfCircle(p, c, radius);
      else pushOutOfBox(p, c, radius);
    }
  }
}
