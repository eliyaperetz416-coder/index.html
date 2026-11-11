// The floor plan of the base, worked out from the list of modules. Pure maths, no 3D:
// which walls have doors, where the corridors and the airlock go, what the player
// bumps into and what counts as "inside".
//
// Every module sits in one square cell of the build grid. Rooms are eight-sided.
// Side 0 faces +z ("south"), side 2 faces +x, side 4 faces -z, side 6 faces -x;
// odd sides are the diagonals.

export const CELL = 10; // metres between the centres of neighbouring cells
export const APOTHEM = 4; // centre of a room to the middle of each wall
export const WALL = 0.3; // wall thickness
export const FLOOR = 0.2; // height of the floors above the ground
export const WALL_H = 3.2; // ceiling height
export const DOOR_W = 1.5;
export const DOOR_H = 2.3;
export const GAP = CELL - APOTHEM * 2; // length of the corridor between two rooms
export const SIDE = 2 * APOTHEM * Math.tan(Math.PI / 8); // length of one wall
const SLAB = APOTHEM + 0.5; // the foundation sticks out a little past the walls
const RAMP = 1.5; // length of the ramp outside the airlock

/** Modules you can walk into. The rest are outdoor machines on a pad. */
export const ENTERABLE = new Set(['core', 'habitat', 'hydro', 'oxygen', 'storage']);

/** Unit vector pointing out of side i. */
export const sideNormal = (i) => [Math.round(Math.sin((i * Math.PI) / 4) * 1e6) / 1e6, Math.round(Math.cos((i * Math.PI) / 4) * 1e6) / 1e6];
const CARDINAL = { 0: [0, 1], 2: [1, 0], 4: [0, -1], 6: [-1, 0] };

// Which diagonal walls get windows, per module type.
const DIAGONAL_WINDOWS = { core: [1, 7], habitat: [1, 3, 5, 7], hydro: [1, 3, 5, 7], oxygen: [1, 7], storage: [] };

/**
 * @param modules  state.modules: [{ id, type, x, z }]
 * @returns the plan:
 *   rooms       [{ id, type, x, z (world metres), enterable, sides: ['door' | 'airlock' | 'window' | 'solid' × 8] }]
 *   connectors  [{ x, z, alongX }]          corridors between two rooms
 *   airlock     { x, z, side, nx, nz } | null   the way outside (x, z = middle of the vestibule)
 *   conduits    [{ ax, az, bx, bz }]        cable runs to outdoor machines
 */
export function planBase(modules) {
  const at = new Map(modules.map((m) => [`${m.x},${m.z}`, m]));
  const neighbour = (m, side) => at.get(`${m.x + CARDINAL[side][0]},${m.z + CARDINAL[side][1]}`);

  // The airlock goes on the first free side of the oldest room, preferring south.
  let airlockOwner = null, airlockSide = null;
  for (const m of [...modules].sort((a, b) => a.id - b.id)) {
    if (!ENTERABLE.has(m.type)) continue;
    const side = [0, 2, 6, 4].find((s) => !neighbour(m, s));
    if (side !== undefined) {
      airlockOwner = m;
      airlockSide = side;
      break;
    }
  }

  const rooms = modules.map((m) => {
    const enterable = ENTERABLE.has(m.type);
    const sides = [];
    for (let i = 0; i < 8; i++) {
      if (!enterable) sides.push(null);
      else if (i % 2 === 1) sides.push(DIAGONAL_WINDOWS[m.type].includes(i) ? 'window' : 'solid');
      else {
        const other = neighbour(m, i);
        if (other && ENTERABLE.has(other.type)) sides.push('door');
        else if (m === airlockOwner && i === airlockSide) sides.push('airlock');
        else sides.push(other ? 'solid' : 'window');
      }
    }
    return { id: m.id, type: m.type, x: m.x * CELL, z: m.z * CELL, enterable, sides };
  });

  const connectors = [], conduits = [];
  for (const m of modules) {
    for (const side of [0, 2]) {
      const other = neighbour(m, side);
      if (!other) continue;
      const mid = { x: ((m.x + other.x) / 2) * CELL, z: ((m.z + other.z) / 2) * CELL };
      if (ENTERABLE.has(m.type) && ENTERABLE.has(other.type)) connectors.push({ ...mid, alongX: side === 2 });
      else conduits.push({ ax: m.x * CELL, az: m.z * CELL, bx: other.x * CELL, bz: other.z * CELL });
    }
  }

  let airlock = null;
  if (airlockOwner) {
    const [nx, nz] = sideNormal(airlockSide);
    const d = APOTHEM + GAP / 2;
    airlock = { x: airlockOwner.x * CELL + nx * d, z: airlockOwner.z * CELL + nz * d, side: airlockSide, nx, nz, roomId: airlockOwner.id };
  }
  return { rooms, connectors, airlock, conduits };
}

/** Is the point inside an eight-sided shape of this apothem centred on (cx, cz)? */
function inOctagon(x, z, cx, cz, apothem) {
  const dx = Math.abs(x - cx), dz = Math.abs(z - cz);
  return dx <= apothem && dz <= apothem && (dx + dz) * Math.SQRT1_2 <= apothem;
}

/**
 * Everything solid, as flat shapes seen from above.
 * @param props  per module type: { circles: [[x, z, r]], segments: [[x1, z1, x2, z2]] } in the room's own coordinates
 * @returns { segments: [{ x1, z1, x2, z2, t }], circles: [{ x, z, r }] }
 */
export function buildColliders(plan, props = {}) {
  const segments = [], circles = [];
  const wall = (x1, z1, x2, z2, t = WALL) => segments.push({ x1, z1, x2, z2, t });

  for (const room of plan.rooms) {
    for (const [px, pz, r] of props[room.type]?.circles ?? []) circles.push({ x: room.x + px, z: room.z + pz, r });
    for (const [x1, z1, x2, z2] of props[room.type]?.segments ?? []) wall(room.x + x1, room.z + z1, room.x + x2, room.z + z2, 0.4);
    if (!room.enterable) continue;
    room.sides.forEach((kind, i) => {
      const [nx, nz] = sideNormal(i);
      const cx = room.x + nx * APOTHEM, cz = room.z + nz * APOTHEM;
      const tx = nz, tz = -nx; // along the wall
      const half = SIDE / 2 + 0.05;
      if (kind === 'door' || kind === 'airlock') {
        const open = DOOR_W / 2;
        wall(cx - tx * half, cz - tz * half, cx - tx * open, cz - tz * open);
        wall(cx + tx * open, cz + tz * open, cx + tx * half, cz + tz * half);
      } else {
        wall(cx - tx * half, cz - tz * half, cx + tx * half, cz + tz * half);
      }
    });
  }

  const tube = (x, z, alongX) => {
    const w = 0.95, l = GAP / 2;
    if (alongX) { wall(x - l, z - w, x + l, z - w, 0.2); wall(x - l, z + w, x + l, z + w, 0.2); }
    else { wall(x - w, z - l, x - w, z + l, 0.2); wall(x + w, z - l, x + w, z + l, 0.2); }
  };
  for (const c of plan.connectors) tube(c.x, c.z, c.alongX);
  if (plan.airlock) tube(plan.airlock.x, plan.airlock.z, plan.airlock.nx !== 0);
  return { segments, circles };
}

/**
 * What is at this spot of the base?
 * @returns null (open ground) or { floor: height, indoors: true/false, room: the room or null }
 */
export function locate(plan, x, z) {
  for (const room of plan.rooms) {
    if (Math.abs(x - room.x) > SLAB || Math.abs(z - room.z) > SLAB) continue;
    if (room.enterable && inOctagon(x, z, room.x, room.z, APOTHEM - WALL / 2)) return { floor: FLOOR, indoors: true, room };
    if (inOctagon(x, z, room.x, room.z, SLAB)) return { floor: FLOOR, indoors: false, room: null };
  }
  for (const c of plan.connectors) {
    const along = c.alongX ? x - c.x : z - c.z, across = c.alongX ? z - c.z : x - c.x;
    if (Math.abs(along) <= GAP / 2 + 0.2 && Math.abs(across) <= 0.95) return { floor: FLOOR, indoors: true, room: null };
  }
  const a = plan.airlock;
  if (a) {
    const along = (x - a.x) * a.nx + (z - a.z) * a.nz, across = Math.abs((x - a.x) * a.nz - (z - a.z) * a.nx);
    if (across <= 0.95) {
      if (Math.abs(along) <= GAP / 2 + 0.2) return { floor: FLOOR, indoors: along < GAP / 2 - 0.2, room: null };
      const down = along - GAP / 2; // on the ramp: slope from the floor to the ground
      if (down > 0 && down < RAMP) return { floor: FLOOR * (1 - down / RAMP), indoors: false, room: null };
    }
  }
  return null;
}

/** Push a circle (the player) out of every wall and prop it overlaps. Changes pos.x / pos.z. */
export function collide(colliders, pos, radius) {
  for (let pass = 0; pass < 2; pass++) {
    for (const s of colliders.segments) {
      const reach = radius + s.t / 2;
      if (Math.min(s.x1, s.x2) - reach > pos.x || Math.max(s.x1, s.x2) + reach < pos.x) continue;
      if (Math.min(s.z1, s.z2) - reach > pos.z || Math.max(s.z1, s.z2) + reach < pos.z) continue;
      const ex = s.x2 - s.x1, ez = s.z2 - s.z1;
      const k = Math.max(0, Math.min(1, ((pos.x - s.x1) * ex + (pos.z - s.z1) * ez) / (ex * ex + ez * ez)));
      let dx = pos.x - (s.x1 + ex * k), dz = pos.z - (s.z1 + ez * k);
      let d = Math.hypot(dx, dz);
      if (d >= reach) continue;
      if (d < 1e-6) { const len = Math.hypot(ex, ez); dx = -ez / len; dz = ex / len; d = 1; }
      pos.x += (dx / d) * (reach - Math.min(d, reach));
      pos.z += (dz / d) * (reach - Math.min(d, reach));
    }
    for (const c of colliders.circles) {
      const dx = pos.x - c.x, dz = pos.z - c.z, reach = radius + c.r;
      if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
      const d = Math.hypot(dx, dz);
      if (d >= reach || d < 1e-6) continue;
      pos.x = c.x + (dx / d) * reach;
      pos.z = c.z + (dz / d) * reach;
    }
  }
}

/**
 * How far along the straight line from → to you get before a wall is in the way (0…1).
 * Used to stop the camera going through walls.
 */
export function sightLimit(colliders, from, to, margin = 0.3) {
  let limit = 1;
  const dx = to.x - from.x, dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) return 1;
  for (const s of colliders.segments) {
    const ex = s.x2 - s.x1, ez = s.z2 - s.z1;
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((s.x1 - from.x) * ez - (s.z1 - from.z) * ex) / den;
    const u = ((s.x1 - from.x) * dz - (s.z1 - from.z) * dx) / den;
    if (t <= 0 || t >= limit || u < -0.05 || u > 1.05) continue;
    const y = from.y + (to.y - from.y) * t;
    if (y > FLOOR + WALL_H + 1.2) continue; // looking over the roof is fine
    limit = Math.max(0, t - (s.t / 2 + margin) / len);
  }
  return limit;
}
