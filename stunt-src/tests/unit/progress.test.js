import { describe, it, expect } from 'vitest';
import { defaultSave } from '../../src/core/storage.js';
import { isUnlocked, medalFor, recordResult, currentTrack, nextTrack } from '../../src/game/progress.js';
import { CAREER } from '../../src/config/tracks.js';

describe('progress', () => {
  it('only the first track is open at the start', () => {
    const save = defaultSave();
    expect(CAREER.map((t) => isUnlocked(save, t))).toEqual([true, false, false, false, false]);
    expect(currentTrack(save).id).toBe(CAREER[0].id);
  });

  it('finishing a track opens the next one and records best time and medal', () => {
    const save = defaultSave();
    const t = CAREER[0];
    const r1 = recordResult(save, t, t.par[2] + 5);
    expect(r1.firstClear).toBe(true);
    expect(r1.medal).toBe(null);
    expect(r1.unlocked.map((u) => u.id)).toEqual([CAREER[1].id]);
    expect(nextTrack(save, t.id).id).toBe(CAREER[1].id);
    const r2 = recordResult(save, t, t.par[0] - 1);
    expect(r2.firstClear).toBe(false);
    expect(r2.newBest).toBe(true);
    expect(r2.medal).toBe('gold');
    expect(r2.betterMedal).toBe(true);
    const r3 = recordResult(save, t, t.par[1] - 0.5);
    expect(r3.newBest).toBe(false);
    expect(r3.betterMedal).toBe(false);
    expect(save.tracks[t.id].medal).toBe('gold');
    expect(save.tracks[t.id].done).toBe(3);
  });

  it('medals follow the par times', () => {
    const t = { par: [40, 45, 50] };
    expect(medalFor(t, 39)).toBe('gold');
    expect(medalFor(t, 44)).toBe('silver');
    expect(medalFor(t, 50)).toBe('bronze');
    expect(medalFor(t, 51)).toBe(null);
  });
});
