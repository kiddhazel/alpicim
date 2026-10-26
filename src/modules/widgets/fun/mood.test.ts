import { describe, expect, it } from 'vitest';
import { monthCount, monthGrid, sanitizeMoodLog, setMood, setNote } from './mood';

describe('mood', () => {
  it('ilk kayıt yeni, tekrar güncelleme yeni değil', () => {
    const a = setMood({}, '2026-10-26', 'good', 'iyi gün');
    expect(a.isNew).toBe(true);
    const b = setMood(a.log, '2026-10-26', 'sad');
    expect(b.isNew).toBe(false);
    expect(b.log['2026-10-26']).toEqual({ mood: 'sad', note: 'iyi gün' });
  });

  it('not 80 karakterle sınırlanır; kayıtsız güne not eklenmez', () => {
    const a = setMood({}, '2026-10-26', 'ok', 'x'.repeat(200));
    expect(a.log['2026-10-26']?.note).toHaveLength(80);
    expect(setNote({}, '2026-10-26', 'a')).toEqual({});
    expect(setNote(a.log, '2026-10-26', 'y'.repeat(90))['2026-10-26']?.note).toHaveLength(80);
  });

  it('bozuk veriyi temizler', () => {
    expect(sanitizeMoodLog({ '2026-01-02': { mood: 'great', note: 5 }, bad: { mood: 'ok' }, '2026-01-03': { mood: 'zzz' } })).toEqual({
      '2026-01-02': { mood: 'great', note: '' },
    });
    expect(sanitizeMoodLog([])).toEqual({});
  });

  it('ay takvimi pazartesi başlar ve haftalar 7 hücredir', () => {
    // Ekim 2026: 1 Ekim Perşembe, 31 gün.
    const weeks = monthGrid(2026, 9, { '2026-10-05': { mood: 'good', note: '' } });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]?.slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0]?.[3]?.day).toBe(1);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.flat().find((c) => c?.day === 5)?.mood).toBe('good');
    expect(weeks).toHaveLength(5);
  });

  it('ay sayacı yalnız o ayı sayar', () => {
    const log = sanitizeMoodLog({ '2026-10-01': { mood: 'ok' }, '2026-10-02': { mood: 'ok' }, '2026-09-30': { mood: 'ok' } });
    expect(monthCount(2026, 9, log)).toBe(2);
  });
});
