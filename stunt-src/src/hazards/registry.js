// Track items: hazards, boost pads and pickups. Every type is a config-driven module with two
// halves:
//   logic: create(def, ctx) -> item   (pure, runs in tests)
//   view:  view(items, ctx) -> { object, update(dt, time) }   (Three.js, batched per type)
//
// Placing items: a track piece can carry `items: [{ type: 'boost', at: 30, x: 0 }, ...]`, where
// `at` is metres from the start of that piece (or `t`, a 0..1 fraction of its length), `x` is
// metres from the centre line (+ right). Tracks can also list `items` with an absolute `s`.
//
// An item has at least { type, s, x, reach } and may implement:
//   update(dt, time)           animate (called every physics step for every item)
//   collide(car, race, dt)     called while the car is within `reach` metres along the track

import { HAZARDS, PRESETS } from '../config/hazards.js';

const TYPES = new Map();

export function registerItem(type, impl) {
  TYPES.set(type, impl);
}

export function itemType(type) {
  const t = TYPES.get(type);
  if (!t) throw new Error(`Unknown item type "${type}"`);
  return t;
}

export function itemTypes() {
  return [...TYPES.keys()];
}

/** Expand presets ({ preset: 'name', at }) into [def, offset along the track] pairs. */
function expand(raw) {
  if (!raw.preset) return [[raw, 0]];
  const list = PRESETS[raw.preset];
  if (!list) throw new Error(`Unknown item preset "${raw.preset}"`);
  const { preset, at, t, s, x = 0, ...rest } = raw;
  return list.map(({ at: offset = 0, ...d }) => [{ ...d, ...rest, x: (d.x ?? 0) + x }, offset]);
}

/** Create every item of a track, sorted by s. Defaults: config/hazards.js, then world.items. */
export function createItems(track, path, world = null) {
  const out = [];
  const add = (raw, anchor) => {
    for (const [def, offset] of expand(raw)) {
      const impl = itemType(def.type);
      const defaults = { ...(HAZARDS[def.type] ?? {}), ...(world?.items?.[def.type] ?? {}) };
      const item = impl.create({ ...defaults, ...def }, { path, s: anchor + offset });
      if (Array.isArray(item)) out.push(...item);
      else out.push(item);
    }
  };
  track.pieces.forEach((piece, index) => {
    if (!piece.items) return;
    const [s0, s1] = path.pieceRange(index);
    for (const raw of piece.items) add(raw, s0 + (raw.t != null ? raw.t * (s1 - s0) : (raw.at ?? 0)));
  });
  for (const raw of track.items ?? []) add(raw, raw.s ?? 0);
  out.sort((a, b) => a.s - b.s);
  out.forEach((it, i) => (it.id = i));
  return out;
}

/**
 * Shared helper for hazards: tracks the closest approach while the car passes, and reports a
 * near miss when the car gets by within `near` metres without being hit.
 */
export class NearMiss {
  constructor(near) {
    this.near = near;
    this.closest = Infinity;
    this.hit = false;
    this.done = false;
  }

  /** gap: clearance in metres between car and hazard (<= 0 means touching). */
  observe(gap) {
    if (gap < this.closest) this.closest = gap;
  }

  /** Call when the car has passed. Returns true once if it was a near miss. */
  passed() {
    if (this.done) return false;
    this.done = true;
    return !this.hit && this.closest > 0 && this.closest < this.near;
  }

  reset() {
    this.closest = Infinity;
    this.hit = false;
    this.done = false;
  }
}

/** Car extents in track coordinates. */
export function carBox(car) {
  return { s: car.trackS, x: car.proj.x, h: car.mode === 'ground' ? 0 : car.proj.h, hl: 2.0, hw: 0.95, hh: 1.4 };
}
