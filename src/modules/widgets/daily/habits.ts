import { addDays, parseDateKey } from '../basic/calendar';
import { obj } from '../types';

/** Haftalık hedef: 1–7 gün. 7 = her gün (günlük seri), 1–6 = haftada N gün (haftalık seri). */
export const DAILY_GOAL = 7;

/** Alışkanlık takibi: her alışkanlık için yapıldığı günler (YYYY-MM-DD, yerel gün). */
export interface Habit {
  id: string;
  name: string;
  /** Artan sırada, tekrarsız gün anahtarları (en çok son 400 gün). */
  days: string[];
  /** Hedef (1–7 gün/hafta). Eski kayıtlarda yoksa 7 (her gün) kabul edilir. */
  goal: number;
}

export interface HabitsConfig {
  habits: Habit[];
}

export const MAX_HABITS = 12;
const MAX_DAYS = 400;
/** Seri rozetlerinin kutlandığı eşikler (gün veya hafta). */
export const MILESTONES = [7, 30, 100] as const;

export const habitsDefaults: HabitsConfig = { habits: [] };

function cleanDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(raw.filter((d): d is string => typeof d === 'string' && parseDateKey(d) !== null));
  return [...set].sort().slice(-MAX_DAYS);
}

export function cleanGoal(raw: unknown): number {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= DAILY_GOAL ? raw : DAILY_GOAL;
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
    habits.push({ id: r.id, name: r.name.trim().slice(0, 60), days: cleanDays(r.days), goal: cleanGoal(r.goal) });
  }
  return { habits };
}

export function addHabit(habits: readonly Habit[], name: string, goal: number = DAILY_GOAL): Habit[] {
  const clean = name.trim().slice(0, 60);
  if (!clean || habits.length >= MAX_HABITS) return [...habits];
  const id = `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return [...habits, { id, name: clean, days: [], goal: cleanGoal(goal) }];
}

export function removeHabit(habits: readonly Habit[], id: string): Habit[] {
  return habits.filter((h) => h.id !== id);
}

export function setGoal(habits: readonly Habit[], id: string, goal: number): Habit[] {
  return habits.map((h) => (h.id === id ? { ...h, goal: cleanGoal(goal) } : h));
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
 * Günü değiştirir ve seri bir eşiğe (7/30/100) ulaştıysa o eşiği döndürür.
 * Yalnızca işaretleme (ekleme) sırasında kutlama tetiklenir.
 */
export function toggleWithMilestone(
  habits: readonly Habit[],
  id: string,
  day: string,
  today: string,
): { habits: Habit[]; milestone: number | null } {
  const before = habits.find((h) => h.id === id);
  const next = toggleDay(habits, id, day, today);
  const after = next.find((h) => h.id === id);
  if (!before || !after || before.days.includes(day) || !after.days.includes(day)) return { habits: next, milestone: null };
  const milestone = milestoneCrossed(habitStats(before, today).streak, habitStats(after, today).streak);
  return { habits: next, milestone };
}

/** `before` < eşik ≤ `after` olan ilk eşik; yoksa null. */
export function milestoneCrossed(before: number, after: number): number | null {
  for (const m of MILESTONES) if (before < m && after >= m) return m;
  return null;
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

/** Haftanın başlangıcı (Pazartesi, YYYY-MM-DD). */
export function weekStart(day: string): string {
  const d = parseDateKey(day);
  if (!d) return day;
  return addDays(day, -((d.getDay() + 6) % 7));
}

/** Haftalık hedef serisi: hedefi tutturulan haftalar üst üste; bu hafta henüz tamamlanmadıysa geçen haftadan sayılır. */
export function weeklyStreaks(days: readonly string[], goal: number, today: string): { current: number; best: number } {
  const counts = new Map<string, number>();
  for (const d of new Set(days)) {
    const w = weekStart(d);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const met = new Set([...counts].filter(([, c]) => c >= goal).map(([w]) => w));
  const thisWeek = weekStart(today);
  let cursor = met.has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  let current = 0;
  while (met.has(cursor)) {
    current++;
    cursor = addDays(cursor, -7);
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const w of [...met].sort()) {
    run = prev !== null && addDays(prev, 7) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return { current, best };
}

export interface HabitStats {
  /** Güncel seri: günlük alışkanlıkta gün, haftalık hedefte hafta sayısı. */
  streak: number;
  best: number;
  unit: 'day' | 'week';
  /** Bu hafta (Pazartesi–bugün) yapılan gün sayısı. */
  weekDone: number;
  goal: number;
}

export function habitStats(habit: Habit, today: string): HabitStats {
  const thisWeek = weekStart(today);
  const weekDone = habit.days.filter((d) => d <= today && weekStart(d) === thisWeek).length;
  if (habit.goal >= DAILY_GOAL) {
    return { streak: currentStreak(habit.days, today), best: bestStreak(habit.days), unit: 'day', weekDone, goal: habit.goal };
  }
  const w = weeklyStreaks(habit.days, habit.goal, today);
  return { streak: w.current, best: w.best, unit: 'week', weekDone, goal: habit.goal };
}

/** Son `n` gün (eskiden yeniye, bugün dahil). */
export function lastDays(today: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}
