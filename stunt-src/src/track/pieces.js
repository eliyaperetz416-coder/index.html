// Track pieces: the building blocks a track config is made of. Each piece compiles to one or
// more low-level segments that the path integrator understands:
//   { length, pitch (total rad), yaw (total rad), lateral (m), bank (rad, peak), flags, width }
// or a gap segment: { gap: true, length (horizontal m), drop (m), landPitch (rad) }.
//
// Units: metres and degrees in configs. Positive turn angle = right turn.

import { DEG } from '../core/math.js';

export const F_SOLID = 1;
export const F_WALLS = 2;
export const F_LOOP = 4; // sticky, low gravity, minimum speed
export const F_LAUNCH = 8; // crests may throw the car into the air
export const F_LIP = 16; // jump lip: leaving the road here gets jump assist
export const F_START = 32;
export const F_FINISH = 64;

export const DEFAULT_WIDTH = 14;

const seg = (piece, o) => ({
  pitch: 0,
  yaw: 0,
  lateral: 0,
  bank: 0,
  flags: F_SOLID | (piece.walls === false ? 0 : F_WALLS) | (piece.launch ? F_LAUNCH : 0),
  width: piece.width ?? null,
  ...o,
});

/** Each compiler returns an array of segments. `ctx.pitch` is the pitch (rad) before the piece. */
export const PIECES = {
  start: (p) => [seg(p, { length: p.length ?? 50, flags: F_SOLID | F_WALLS | F_START })],

  straight: (p) => [seg(p, { length: p.length ?? 60 })],

  finish: (p) => [seg(p, { length: p.length ?? 90, flags: F_SOLID | F_WALLS | F_FINISH })],

  turn: (p) => {
    const angle = (p.angle ?? 90) * DEG;
    const radius = p.radius ?? 90;
    const bank = (p.bank ?? Math.min(18, Math.abs(p.angle ?? 90) / 6)) * DEG * Math.sign(angle);
    return [seg(p, { length: radius * Math.abs(angle), yaw: -angle, bank })];
  },

  // Changes height: curve, straight slope, curve back. Negative height goes down.
  climb: (p) => slope(p, p.height ?? 20, p.angle ?? 30, p.radius ?? 40),
  drop: (p) => slope(p, -(p.height ?? 30), p.angle ?? 55, p.radius ?? 30),

  // A crest that can launch the car at speed.
  hill: (p) => {
    const L = p.length ?? 90;
    const a = (p.angle ?? 12) * DEG;
    const q = { ...p, launch: p.launch ?? true };
    return [
      seg(q, { length: L / 4, pitch: a }),
      seg(q, { length: L / 2, pitch: -2 * a }),
      seg(q, { length: L / 4, pitch: a }),
    ];
  },

  // 360 degree vertical loop. `offset` shifts the exit sideways so it clears the entry.
  loop: (p) => {
    const r = p.radius ?? 16;
    const width = p.width ?? DEFAULT_WIDTH;
    return [
      seg(p, {
        length: 2 * Math.PI * r,
        pitch: 2 * Math.PI,
        lateral: (p.side ?? 1) * (p.offset ?? width + 3),
        flags: F_SOLID | F_WALLS | F_LOOP,
      }),
    ];
  },

  // Kicker ramp, empty gap, landing slope. Jump assist makes sure the car clears the gap.
  jump: (p, ctx) => {
    const angle = (p.angle ?? 18) * DEG;
    const rampLength = p.rampLength ?? 32;
    const landAngle = (p.landAngle ?? 10) * DEG;
    const landLength = p.landLength ?? 50;
    const lip = { ...p };
    return [
      seg(lip, { length: rampLength * 0.65, pitch: angle }),
      seg(lip, { length: rampLength * 0.35, flags: F_SOLID | F_LIP | (p.walls === false ? 0 : F_WALLS) }),
      { gap: true, length: p.gap ?? 36, drop: p.drop ?? 4, landPitch: ctx.pitch - landAngle, width: p.width ?? null, flips: p.flips ?? 0, rolls: p.rolls ?? 0 },
      seg(p, { length: landLength * 0.55, pitch: landAngle }),
      seg(p, { length: landLength * 0.45 }),
    ];
  },

  // Raw gap, for custom builds.
  gap: (p, ctx) => [{ gap: true, length: p.length ?? 30, drop: p.drop ?? 0, landPitch: ctx.pitch, width: p.width ?? null, flips: 0, rolls: 0 }],
};

function slope(p, height, angleDeg, radius) {
  const dir = Math.sign(height) || 1;
  const h = Math.abs(height);
  let a = angleDeg * DEG;
  // Shrink the angle if the two curves alone would already exceed the height.
  while (2 * radius * (1 - Math.cos(a)) > h && a > 2 * DEG) a *= 0.9;
  const arc = radius * a;
  const straight = Math.max(0, (h - 2 * radius * (1 - Math.cos(a))) / Math.sin(a));
  const out = [seg(p, { length: arc, pitch: dir * a })];
  if (straight > 0.5) out.push(seg(p, { length: straight }));
  out.push(seg(p, { length: arc, pitch: -dir * a }));
  return out;
}

/** Compile a list of piece configs into segments. Each segment remembers its piece index. */
export function compilePieces(pieces) {
  const out = [];
  const ctx = { pitch: 0 };
  pieces.forEach((piece, index) => {
    const compile = PIECES[piece.type];
    if (!compile) throw new Error(`Unknown track piece type "${piece.type}"`);
    for (const s of compile(piece, ctx)) {
      s.piece = index;
      out.push(s);
      ctx.pitch = s.gap ? s.landPitch : ctx.pitch + s.pitch;
    }
  });
  return out;
}
