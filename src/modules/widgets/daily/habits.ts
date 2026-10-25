import { addDays, parseDateKey } from '../basic/calendar';
import { obj } from '../types';

/** Alışkanlık takibi: her alışkanlık için yapıldığı günler (YYYY-MM-DD, yerel gün). */
export interface Habit {
  id: string;
  name: string;
  /** Artan sırada, tekrarsız gün anahtarları (en çok son 400 gün). */
  days: string[];
}

export interface HabitsConfig {
  habits: Habit[];
}

export const MAX_HABITS = 12;
const MAX_DAYS = 400;

export const habitsDefaults: HabitsConfig = { habits: [] };

function cleanDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(raw.filter((d): d is string => typeof d === 'string' && parseDateKey(d) !== null));
  return [...set].sort().slice(-MAX_DAYS);
}

export function sanitizeHabits(raw: unknown): HabitsConfig {
  const list = obj(raw).habits;
  if (!Array.isArray(list)) return { habits: [] };
  const seen = new Set<string>();
  const habits: Habit[] = [];
  for (const h of list.slice(0, MAX_HABITS)) {
    const r = obj(h);
    if (typeof r.id !== 'string' || !r.id || seen.has(r.id) || typeof r.name !== 'string' || !r.name.trim()) continue;
    seen.add(r.id);
    habits.push({ id: r.id, name: r.name.trim().slice(0, 60), days: cleanDays(r.days) });
  }
  return { habits };
}

export function addHabit(habits: readonly Habit[], name: string): Habit[] {
  const clean = name.trim().slice(0, 60);
  if (!clean || habits.length >= MAX_HABITS) return [...habits];
  return [...habits, { id: `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: clean, days: [] }];
}

export function removeHabit(habits: readonly Habit[], id: string): Habit[] {
  return habits.filter((h) => h.id !== id);
}

export function isDone(habit: Habit, day: string): boolean {
  return habit.days.includes(day);
}

/** Günü işaretler/işareti kaldırır. Gelecek günler değiştirilemez. */
export function toggleDay(habits: readonly Habit[], id: string, day: string, today: string): Habit[] {
  if (day > today || parseDateKey(day) === null) return [...habits];
  return habits.map((h) => {
    if (h.id !== id) return h;
    const days = h.days.includes(day) ? h.days.filter((d) => d !== day) : [...h.days, day].sort().slice(-MAX_DAYS);
    return { ...h, days };
  });
}

/**
 * Güncel seri: bugün yapıldıysa bugünden, yapılmadıysa dünden geriye kesintisiz gün sayısı
 * (bugün henüz işaretlenmedi diye seri sıfırlanmaz).
 */
export function currentStreak(days: readonly string[], today: string): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Kayıtlardaki en uzun kesintisiz seri. */
export function bestStreak(days: readonly string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Son `n` gün (eskiden yeniye, bugün dahil). */
export function lastDays(today: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}
