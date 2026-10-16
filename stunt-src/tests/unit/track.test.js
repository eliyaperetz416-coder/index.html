import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { TrackPath, STEP, F_SOLID, F_LOOP } from '../../src/track/path.js';
import { TRACKS } from '../../src/config/tracks.js';

describe('TrackPath', () => {
  it('a straight goes forward along +Z with up +Y and right -X', () => {
    const p = new TrackPath({ pieces: [{ type: 'straight', length: 100 }] });
    const f = p.sampleAt(50);
    expect(f.pos.z).toBeCloseTo(50, 3);
    expect(f.T.z).toBeCloseTo(1, 5);
    expect(f.U.y).toBeCloseTo(1, 5);
    expect(f.R.x).toBeCloseTo(-1, 5);
  });

  it('a loop comes back to its start height and heading, shifted sideways', () => {
    const p = new TrackPath({ pieces: [{ type: 'straight', length: 20 }, { type: 'loop', radius: 15, offset: 16 }, { type: 'straight', length: 20 }] });
    const [s0, s1] = p.pieceRange(1);
    const a = p.sampleAt(s0);
    const b = p.sampleAt(s1);
    expect(b.pos.y).toBeCloseTo(a.pos.y, 1);
    expect(Math.abs(b.pos.x - a.pos.x)).toBeCloseTo(16, 0);
    expect(b.T.dot(a.T)).toBeGreaterThan(0.999);
    // Top of the loop is upside down, about 2r up.
    const top = p.sampleAt((s0 + s1) / 2);
    expect(top.U.y).toBeLessThan(-0.99);
    expect(top.pos.y - a.pos.y).toBeGreaterThan(29);
    expect(p.flagsAt((s0 + s1) / 2) & F_LOOP).toBeTruthy();
  });

  it('a right turn turns right', () => {
    const p = new TrackPath({ pieces: [{ type: 'turn', angle: 90, radius: 50 }] });
    const end = p.sampleAt(p.length);
    // Started facing +Z with right = -X, so a right turn ends facing -X.
    expect(end.T.x).toBeCloseTo(-1, 2);
  });

  it('a jump leaves a non-solid gap of the right size', () => {
    const p = new TrackPath({ pieces: [{ type: 'straight', length: 20 }, { type: 'jump', gap: 30, drop: 5 }, { type: 'straight', length: 20 }] });
    expect(p.gaps.length).toBe(1);
    const g = p.gaps[0];
    expect(g.from.distanceTo(g.to)).toBeCloseTo(Math.hypot(30, 5), 0);
    expect(p.flagsAt((g.s0 + g.s1) / 2) & F_SOLID).toBe(0);
    expect(p.flagsAt(g.s1 + 1) & F_SOLID).toBeTruthy();
  });

  it('project() finds track coordinates of a world point', () => {
    const p = new TrackPath({ pieces: [{ type: 'turn', angle: 60, radius: 80 }, { type: 'straight', length: 50 }] });
    const w = p.pointAt(40, 3, 1.5, new Vector3());
    const pr = p.project(w, 30, 20, 40);
    expect(pr.s).toBeCloseTo(40, 0);
    expect(pr.x).toBeCloseTo(3, 1);
    expect(pr.h).toBeCloseTo(1.5, 1);
  });

  it('every configured track builds with frames that stay orthonormal', () => {
    for (const t of TRACKS) {
      const p = new TrackPath(t);
      expect(p.finishS).toBeGreaterThan(p.startS);
      for (let s = 0; s < p.length; s += STEP * 7) {
        const f = p.sampleAt(s);
        expect(Math.abs(f.T.dot(f.U))).toBeLessThan(0.02);
        expect(Math.abs(f.T.dot(f.R))).toBeLessThan(0.02);
        expect(Number.isFinite(f.pos.x + f.pos.y + f.pos.z)).toBe(true);
      }
    }
  });
});
