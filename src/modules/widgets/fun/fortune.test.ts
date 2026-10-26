import { describe, expect, it } from 'vitest';
import { fortuneForDay, sanitizeFortune } from './fortune';

describe('fortune', () => {
  it('picks an index inside the list', () => {
    expect(fortuneForDay('2026-10-26', 20, 0)).toEqual({ day: '2026-10-26', index: 0 });
    expect(fortuneForDay('2026-10-26', 20, 0.5)).toEqual({ day: '2026-10-26', index: 10 });
    expect(fortuneForDay('2026-10-26', 20, 1).index).toBe(19);
    expect(fortuneForDay('2026-10-26', 0, 0.9).index).toBe(0);
  });

  it('sanitizes stored state', () => {
    expect(sanitizeFortune({ day: '2026-10-26', index: 3 })).toEqual({ day: '2026-10-26', index: 3 });
    expect(sanitizeFortune({ day: '26.10.2026', index: 3 })).toBeNull();
    expect(sanitizeFortune({ day: '2026-10-26', index: -1 })).toBeNull();
    expect(sanitizeFortune({ day: '2026-10-26', index: 1.5 })).toBeNull();
    expect(sanitizeFortune(null)).toBeNull();
  });
});
