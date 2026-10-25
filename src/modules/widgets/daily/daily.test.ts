import { describe, expect, it } from 'vitest';
import type { Quote } from '../../markets/types';
import { sanitizeWidgets } from '../../workspaces/workspaces';
import { convert, parseAmount, ratesFromQuotes, sanitizeConverter } from './converter';
import { addCountdown, daysBetween, nextOccurrence, occurrences, sanitizeCountdown, type CountdownEvent } from './countdown';
import { addHabit, bestStreak, currentStreak, lastDays, sanitizeHabits, toggleDay } from './habits';

describe('habits', () => {
  it('sanitizes and dedupes days', () => {
    const cfg = sanitizeHabits({
      habits: [
        { id: 'a', name: ' Kitap ', days: ['2026-10-02', '2026-10-01', '2026-10-02', 'bozuk', '2026-02-30'] },
        { id: 'a', name: 'tekrar' },
        { id: 'b', name: '' },
      ],
    });
    expect(cfg.habits).toEqual([{ id: 'a', name: 'Kitap', days: ['2026-10-01', '2026-10-02'] }]);
    expect(sanitizeHabits(null)).toEqual({ habits: [] });
  });

  it('toggles days but never the future', () => {
    const habits = addHabit([], 'Su iç');
    const id = habits[0]?.id as string;
    const on = toggleDay(habits, id, '2026-10-25', '2026-10-25');
    expect(on[0]?.days).toEqual(['2026-10-25']);
    expect(toggleDay(on, id, '2026-10-25', '2026-10-25')[0]?.days).toEqual([]);
    expect(toggleDay(habits, id, '2026-10-26', '2026-10-25')[0]?.days).toEqual([]);
  });

  it('computes streaks across month boundaries', () => {
    const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-03'];
    expect(currentStreak(days, '2026-10-01')).toBe(3);
    // Bugün henüz işaretlenmedi: dünden itibaren sayılır.
    expect(currentStreak(days, '2026-10-02')).toBe(3);
    expect(currentStreak(days, '2026-10-05')).toBe(0);
    expect(bestStreak(days)).toBe(3);
    expect(lastDays('2026-10-02', 3)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });
});

describe('countdown', () => {
  const ev = (date: string, repeat: CountdownEvent['repeat'], id = date): CountdownEvent => ({ id, title: id, date, repeat });

  it('validates events', () => {
    const cfg = sanitizeCountdown({ events: [{ id: 'a', title: 'Bayram', date: '2027-03-20', repeat: 'x' }, { id: 'b', title: 'x', date: '2027-13-01' }] });
    expect(cfg.events).toEqual([{ id: 'a', title: 'Bayram', date: '2027-03-20', repeat: 'none' }]);
    expect(addCountdown([], ' ', '2027-01-01', 'none')).toBeNull();
    expect(addCountdown([], 'Maaş', '2026-10-15', 'monthly')?.[0]).toMatchObject({ title: 'Maaş', repeat: 'monthly' });
  });

  it('finds next monthly and yearly occurrences', () => {
    expect(nextOccurrence(ev('2026-01-15', 'monthly'), '2026-10-10')).toBe('2026-10-15');
    expect(nextOccurrence(ev('2026-01-15', 'monthly'), '2026-10-16')).toBe('2026-11-15');
    expect(nextOccurrence(ev('2026-01-31', 'monthly'), '2026-11-01')).toBe('2026-11-30');
    expect(nextOccurrence(ev('2026-01-15', 'monthly'), '2026-12-20')).toBe('2027-01-15');
    expect(nextOccurrence(ev('2020-05-19', 'yearly'), '2026-10-25')).toBe('2027-05-19');
    expect(nextOccurrence(ev('2024-02-29', 'yearly'), '2026-01-01')).toBe('2026-02-28');
    expect(nextOccurrence(ev('2026-10-25', 'yearly'), '2026-10-25')).toBe('2026-10-25');
  });

  it('counts calendar days independent of DST and sorts', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-25', '2026-10-24')).toBe(-1);
    const list = occurrences([ev('2026-10-20', 'none', 'past'), ev('2026-12-31', 'none', 'far'), ev('2026-10-26', 'none', 'near')], '2026-10-25');
    expect(list.map((o) => [o.event.id, o.days])).toEqual([
      ['near', 1],
      ['far', 67],
      ['past', -5],
    ]);
  });
});

describe('workspace persistence', () => {
  it('keeps the new widget types when sanitizing saved layouts', () => {
    const raw = ['habits', 'countdown', 'converter', 'quicknote', 'unknown'].map((type, i) => ({ id: `w${i}`, type, x: 0, y: i * 3, w: 4, h: 3 }));
    expect(sanitizeWidgets(raw).map((w) => w.type)).toEqual(['habits', 'countdown', 'converter', 'quicknote']);
  });
});

describe('converter', () => {
  const q = (symbol: string, price: number, kind: Quote['kind'] = 'reference'): Quote => ({
    key: symbol,
    symbol,
    label: symbol,
    price,
    change: null,
    changePct: null,
    currency: 'TRY',
    kind,
    providerId: 'tcmb',
    sourceName: 'TCMB',
    asOf: null,
    fetchedAt: 0,
  });

  it('only uses reference TRY quotes', () => {
    const rates = ratesFromQuotes([q('USD/TRY', 40), q('EUR/TRY', 46), q('XAU/TRY', 4000, 'market'), q('JPY/TRY', 0.27)]);
    expect([...rates.keys()].sort()).toEqual(['EUR', 'JPY', 'TRY', 'USD']);
    expect(ratesFromQuotes([])).toEqual(new Map());
    expect(convert(100, 'USD', 'TRY', rates)).toBe(4000);
    expect(convert(4600, 'TRY', 'EUR', rates)).toBe(100);
    expect(convert(46, 'EUR', 'USD', rates)).toBeCloseTo(52.9, 1);
    expect(convert(1, 'GBP', 'TRY', rates)).toBeNull();
  });

  it('parses Turkish and English amounts', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('1.000')).toBe(1000);
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('1 250 ₺')).toBe(1250);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1.2.3,4')).toBe(123.4);
  });

  it('sanitizes config', () => {
    expect(sanitizeConverter({ amount: '50', from: 'eur', to: 'GBP' })).toEqual({ amount: '50', from: 'USD', to: 'GBP' });
  });
});
