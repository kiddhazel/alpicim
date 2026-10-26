/** Ruh hâli günlüğü (saf mantık): kayıtlar ve ay takvimi ısı haritası. */

export const MOOD_KEY = 'mood.log';
export const MOOD_IDS = ['great', 'good', 'ok', 'tired', 'sad', 'angry'] as const;
export type MoodId = (typeof MOOD_IDS)[number];
export const MOOD_NOTE_MAX = 80;

export interface MoodEntry {
  mood: MoodId;
  note: string;
}

export type MoodLog = Record<string, MoodEntry>;

/** Isı haritası: tek vurgu rengi, yoğunluk (yüzde) iyiden kötüye azalır. */
export const MOOD_TINT: Record<MoodId, number> = {
  great: 90,
  good: 70,
  ok: 50,
  tired: 35,
  sad: 22,
  angry: 12,
};

export const moodTint = (m: MoodId): string => `color-mix(in srgb, var(--accent) ${MOOD_TINT[m]}%, transparent)`;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isMoodId(v: unknown): v is MoodId {
  return typeof v === 'string' && (MOOD_IDS as readonly string[]).includes(v);
}

export function sanitizeMoodLog(raw: unknown): MoodLog {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: MoodLog = {};
  for (const [day, v] of Object.entries(raw)) {
    if (!DAY_RE.test(day) || typeof v !== 'object' || v === null) continue;
    const e = v as Record<string, unknown>;
    if (!isMoodId(e.mood)) continue;
    out[day] = { mood: e.mood, note: typeof e.note === 'string' ? e.note.slice(0, MOOD_NOTE_MAX) : '' };
  }
  return out;
}

/** Bir günün kaydını yazar/günceller; ilk kez mi yazıldığını bildirir. */
export function setMood(log: MoodLog, day: string, mood: MoodId, note?: string): { log: MoodLog; isNew: boolean } {
  const prev = log[day];
  const nextNote = (note ?? prev?.note ?? '').slice(0, MOOD_NOTE_MAX);
  return { log: { ...log, [day]: { mood, note: nextNote } }, isNew: prev === undefined };
}

export function setNote(log: MoodLog, day: string, note: string): MoodLog {
  const prev = log[day];
  if (!prev) return log;
  return { ...log, [day]: { ...prev, note: note.slice(0, MOOD_NOTE_MAX) } };
}

export interface MonthCell {
  /** YYYY-MM-DD. */
  key: string;
  day: number;
  mood: MoodId | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Ay takvimi: pazartesi başlangıçlı haftalar; ay dışı hücreler null.
 * `month` 0 tabanlı.
 */
export function monthGrid(year: number, month: number, log: MoodLog): Array<Array<MonthCell | null>> {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<MonthCell | null> = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${pad(month + 1)}-${pad(d)}`;
    cells.push({ key, day: d, mood: log[key]?.mood ?? null });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<MonthCell | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** O aydaki kayıtlı gün sayısı. */
export function monthCount(year: number, month: number, log: MoodLog): number {
  const prefix = `${year}-${pad(month + 1)}-`;
  return Object.keys(log).filter((k) => k.startsWith(prefix)).length;
}
