import { describe, expect, it } from 'vitest';
import { currentHoliday } from './holidays';
import { daypartForHour, fireworksLive, sceneKinds, weatherGroup } from './ambient';

describe('currentHoliday', () => {
  it('finds holidays', () => {
    expect(currentHoliday(new Date(2026, 9, 26))).toBe('halloween');
    expect(currentHoliday(new Date(2026, 9, 29))).toBe('republic');
    expect(currentHoliday(new Date(2026, 11, 31))).toBe('newYear');
    expect(currentHoliday(new Date(2026, 2, 21))).toBe('ramadan');
    expect(currentHoliday(new Date(2026, 6, 1))).toBeNull();
  });
});

describe('ambient', () => {
  it('maps hours and weather', () => {
    expect(daypartForHour(3)).toBe('night');
    expect(daypartForHour(6)).toBe('dawn');
    expect(daypartForHour(12)).toBe('day');
    expect(daypartForHour(18)).toBe('sunset');
    expect(weatherGroup(0)).toBe('sunny');
    expect(weatherGroup(63)).toBe('rain');
    expect(weatherGroup(75)).toBe('snow');
  });

  it('builds scenes', () => {
    const base = { daypart: 'night' as const, weatherCode: 0, holiday: null, weatherFx: true, ambientFx: true };
    expect(sceneKinds(base)).toContain('stars');
    expect(sceneKinds({ ...base, daypart: 'day' })).toContain('sun');
    expect(sceneKinds({ ...base, holiday: 'halloween' })).toContain('bats');
    expect(sceneKinds({ ...base, weatherCode: 63 })).not.toContain('stars');
  });

  it('fireworks timing', () => {
    expect(fireworksLive('newYear', new Date(2026, 11, 31, 23, 30), false)).toBe(true);
    expect(fireworksLive('newYear', new Date(2026, 11, 31, 12, 0), false)).toBe(false);
    expect(fireworksLive('republic', new Date(2026, 9, 29, 12, 0), false)).toBe(true);
  });
});
