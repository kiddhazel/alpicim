import { describe, expect, it } from 'vitest';
import type { Quote } from '../../markets/types';
import { sanitizeWidgets } from '../../workspaces/workspaces';
import { convert, parseAmount, ratesFromQuotes, sanitizeConverter } from './converter';
import { addCountdown, daysBetween, nextOccurrence, occurrences, sanitizeCountdown, type CountdownEvent } from './countdown';
import {
  addHabit,
  bestStreak,
  currentStreak,
  habitStats,
  lastDays,
  milestoneCrossed,
  sanitizeHabits,
  setGoal,
  toggleDay,
  toggleWithMilestone,
  weekStart,
  weeklyStreaks,
  type Habit,
} from './habits';

describe('habits', () => {
  it('sanitizes and dedupes days', () => {
    const cfg = sanitizeHabits({
      habits: [
        { id: 'a', name: ' Kitap ', days: ['2026-10-02', '2026-10-01', '2026-10-02', 'bozuk', '2026-02-30'] },
        { id: 'a', name: 'tekrar' },
        { id: 'b', name: '' },
      ],
    });
    expect(cfg.habits).toEqual([{ id: 'a', name: 'Kitap', days: ['2026-10-01', '2026-10-02'], goal: 7 }]);
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

  it('keeps old entries compatible and validates goals', () => {
    expect(sanitizeHabits({ habits: [{ id: 'a', name: 'Yürüyüş', days: [], goal: 3 }] }).habits[0]?.goal).toBe(3);
    expect(sanitizeHabits({ habits: [{ id: 'a', name: 'Yürüyüş', days: [], goal: 0 }] }).habits[0]?.goal).toBe(7);
    expect(sanitizeHabits({ habits: [{ id: 'a', name: 'Yürüyüş', days: [], goal: 2.5 }] }).habits[0]?.goal).toBe(7);
    expect(sanitizeHabits({ habits: [{ id: 'a', name: 'Yürüyüş', days: [], goal: 9 }] }).habits[0]?.goal).toBe(7);
    expect(addHabit([], 'Yüzme', 2)[0]?.goal).toBe(2);
    const habits = addHabit([], 'Yüzme');
    expect(setGoal(habits, habits[0]?.id ?? '', 4)[0]?.goal).toBe(4);
  });

  it('finds the start of the Monday-based week', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // Pazar
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // Pazartesi
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
  });

  it('computes weekly-goal streaks', () => {
    // 3 gün/hafta hedefi: iki tam hafta + bu hafta henüz 1 gün.
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-21'];
    expect(weeklyStreaks(days, 3, '2026-10-22')).toEqual({ current: 2, best: 2 });
    // Bu hafta hedef tutturulunca seri uzar.
    expect(weeklyStreaks([...days, '2026-10-22', '2026-10-23'], 3, '2026-10-25')).toEqual({ current: 3, best: 3 });
    // Ara hafta hedefi tutturmazsa seri kopar: bu hafta 1, en uzun 1.
    expect(weeklyStreaks(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-19', '2026-10-20', '2026-10-21'], 3, '2026-10-22')).toEqual({ current: 1, best: 1 });
  });

  it('builds habit stats for daily and weekly goals', () => {
    const daily: Habit = { id: 'd', name: 'Kitap', days: ['2026-10-23', '2026-10-24', '2026-10-25'], goal: 7 };
    expect(habitStats(daily, '2026-10-25')).toEqual({ streak: 3, best: 3, unit: 'day', weekDone: 3, goal: 7 });
    const weekly: Habit = { ...daily, id: 'w', goal: 2 };
    expect(habitStats(weekly, '2026-10-25')).toEqual({ streak: 1, best: 1, unit: 'week', weekDone: 3, goal: 2 });
  });

  it('celebrates only when a streak reaches a milestone', () => {
    expect(milestoneCrossed(6, 7)).toBe(7);
    expect(milestoneCrossed(7, 8)).toBeNull();
    expect(milestoneCrossed(29, 30)).toBe(30);
    expect(milestoneCrossed(99, 100)).toBe(100);
    expect(milestoneCrossed(3, 3)).toBeNull();

    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
    const habits: Habit[] = [{ id: 'a', name: 'Koş', days, goal: 7 }];
    expect(toggleWithMilestone(habits, 'a', '2026-10-25', '2026-10-25').milestone).toBe(7);
    // Geri alma kutlama tetiklemez.
    const seven: Habit[] = [{ id: 'a', name: 'Koş', days: [...days, '2026-10-25'], goal: 7 }];
    expect(toggleWithMilestone(seven, 'a', '2026-10-25', '2026-10-25').milestone).toBeNull();
    expect(toggleWithMilestone(habits, 'a', '2026-10-26', '2026-10-25').milestone).toBeNull();
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
