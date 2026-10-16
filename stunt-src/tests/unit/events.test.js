import { describe, it, expect } from 'vitest';
import { EVENTS, EVENT_BY_ID, eventStatus, calendar, recordEvent, goalMet, eventTrackId, openEvents } from '../../src/game/events.js';
import { TRACK_BY_ID } from '../../src/config/tracks.js';
import { CAR_BY_ID } from '../../src/config/cars.js';
import { defaultSave } from '../../src/core/storage.js';
import { carState, buyCar, effectiveStats } from '../../src/game/economy.js';
import { Race } from '../../src/game/race.js';
import { Driver } from '../../src/game/ai.js';
import { rng } from '../../src/core/math.js';

const fri = new Date(2026, 9, 16, 12); // Friday 16 Oct 2026
const mon = new Date(2026, 9, 19, 12);

describe('event schedule', () => {
  it('fixed events are upcoming, live, then ended', () => {
    const e = EVENT_BY_ID['pumpkin-rush'];
    expect(eventStatus(e, fri).state).toBe('upcoming');
    expect(eventStatus(e, new Date(2026, 9, 20, 0, 1)).state).toBe('live');
    expect(eventStatus(e, new Date(2026, 10, 2, 23, 59)).state).toBe('live');
    expect(eventStatus(e, new Date(2026, 10, 3, 0, 1)).state).toBe('ended');
  });

  it('weekly events run on their days and end at midnight after the last one', () => {
    const e = EVENT_BY_ID['moon-jump']; // Fri-Sun
    const st = eventStatus(e, fri);
    expect(st.state).toBe('live');
    expect(st.end).toEqual(new Date(2026, 9, 19)); // Monday 00:00
    const next = eventStatus(e, mon);
    expect(next.state).toBe('upcoming');
    expect(next.start).toEqual(new Date(2026, 9, 23));
  });

  it('there is always something live, and the calendar sorts live / upcoming / ended', () => {
    for (let d = 0; d < 14; d++) expect(calendar(new Date(2026, 9, 16 + d, 12)).live.length).toBeGreaterThan(0);
    const cal = calendar(fri);
    expect(cal.ended.map((x) => x.event.id)).toContain('gold-rush');
    expect(cal.upcoming.map((x) => x.event.id)).toContain('pumpkin-rush');
  });
});

describe('event content', () => {
  it('every event has a track and its reward car exists and cannot be bought', () => {
    for (const e of EVENTS) {
      expect(TRACK_BY_ID[eventTrackId(e)]).toBeTruthy();
      if (e.rewards.car) {
        expect(CAR_BY_ID[e.rewards.car]?.eventOnly).toBe(true);
        const save = defaultSave();
        save.coins = 1e6;
        expect(buyCar(save, e.rewards.car).ok).toBe(false);
      }
    }
  });

  it('every event course can be driven and its goal reached by a good driver', () => {
    for (const e of EVENTS) {
      const track = TRACK_BY_ID[eventTrackId(e)];
      const race = new Race({ track, stats: effectiveStats(CAR_BY_ID.kestrel), modifiers: e.modifiers });
      const d = new Driver({ random: rng(2) });
      for (let t = 0; t < 150 && race.state !== 'finished'; t += 1 / 60) {
        // Drift goals: weave hard on the slick turns.
        const input = { ...d.update(1 / 60, race, race.car) };
        if (e.goal.type === 'drift') input.steer = Math.sin(race.time * 1.4) > 0 ? 1 : -1;
        race.update(1 / 60, input);
        race.events.length = 0;
      }
      expect(race.state, e.id).toBe('finished');
      expect(race.finishTime, e.id).toBeGreaterThan(20);
      expect(goalMet(e.goal, race), `${e.id} goal ${JSON.stringify(e.goal)} time ${race.finishTime.toFixed(1)} coins ${race.score.coinsPicked} drift ${race.score.drift.toFixed(1)}`).toBe(true);
    }
  });
});

describe('event rewards', () => {
  it('meeting the goal while live pays once and gives the event car', () => {
    const save = defaultSave();
    const e = EVENT_BY_ID['moon-jump'];
    const race = { state: 'finished', finishTime: 50, score: { coinsPicked: 0, drift: 0 } };
    const r1 = recordEvent(save, e, race, fri);
    expect(r1.rewards.coins).toBe(e.rewards.coins);
    expect(r1.rewards.car).toBe('lunar');
    expect(carState(save, 'lunar').owned).toBe(true);
    const coins = save.coins;
    const r2 = recordEvent(save, e, race, fri);
    expect(r2.rewards).toBe(null);
    expect(save.coins).toBe(coins);
    expect(openEvents(save, fri).map((x) => x.id)).not.toContain('moon-jump');
  });

  it('no rewards outside the event window, or when the goal is missed', () => {
    const save = defaultSave();
    const e = EVENT_BY_ID['moon-jump'];
    expect(recordEvent(save, e, { state: 'finished', finishTime: 50, score: {} }, mon).rewards).toBe(null);
    expect(recordEvent(save, e, { state: 'finished', finishTime: 90, score: {} }, fri).rewards).toBe(null);
  });
});
