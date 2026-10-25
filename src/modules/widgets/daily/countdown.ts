import { pad2, parseDateKey } from '../basic/calendar';
import { obj } from '../types';

/** Geri sayım: adlandırılmış tarihlere kalan gün (bir kez / her ay / her yıl). */
export type Repeat = 'none' | 'monthly' | 'yearly';
export const REPEATS: readonly Repeat[] = ['none', 'monthly', 'yearly'];

export interface CountdownEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD (tekrarlıysa ilk tarih; ay/gün buradan alınır). */
  date: string;
  repeat: Repeat;
}

export interface CountdownConfig {
  events: CountdownEvent[];
}

export interface Occurrence {
  event: CountdownEvent;
  /** Bir sonraki (veya geçmişse son) tarih. */
  date: string;
  /** Bugünden kalan gün; geçmiş tek seferlik tarihlerde negatif. */
  days: number;
}

export const MAX_COUNTDOWNS = 20;
export const countdownDefaults: CountdownConfig = { events: [] };

export function sanitizeCountdown(raw: unknown): CountdownConfig {
  const list = obj(raw).events;
  if (!Array.isArray(list)) return { events: [] };
  const seen = new Set<string>();
  const events: CountdownEvent[] = [];
  for (const e of list.slice(0, MAX_COUNTDOWNS)) {
    const r = obj(e);
    if (typeof r.id !== 'string' || !r.id || seen.has(r.id)) continue;
    if (typeof r.title !== 'string' || !r.title.trim() || typeof r.date !== 'string' || !parseDateKey(r.date)) continue;
    seen.add(r.id);
    events.push({
      id: r.id,
      title: r.title.trim().slice(0, 60),
      date: r.date,
      repeat: REPEATS.includes(r.repeat as Repeat) ? (r.repeat as Repeat) : 'none',
    });
  }
  return { events };
}

export function addCountdown(events: readonly CountdownEvent[], title: string, date: string, repeat: Repeat): CountdownEvent[] | null {
  const clean = title.trim().slice(0, 60);
  if (!clean || !parseDateKey(date) || events.length >= MAX_COUNTDOWNS) return null;
  return [...events, { id: `cd${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: clean, date, repeat }];
}

function parts(key: string): [number, number, number] {
  const d = parseDateKey(key) ?? new Date();
  return [d.getFullYear(), d.getMonth(), d.getDate()];
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function key(year: number, month: number, day: number): string {
  // Ay taşmasını normalleştir (ör. 12 → sonraki yılın 0'ı).
  const d = new Date(year, month, 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  return `${y}-${pad2(m + 1)}-${pad2(Math.min(day, daysInMonth(y, m)))}`;
}

/** İki gün anahtarı arasındaki takvim günü farkı (b - a); yaz saatinden etkilenmez. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm, bd) - Date.UTC(ay, am, ad)) / 86_400_000);
}

/** Bugünden itibaren bir sonraki gerçekleşme tarihi (tek seferlikte tarihin kendisi). */
export function nextOccurrence(event: CountdownEvent, today: string): string {
  if (event.repeat === 'none') return event.date;
  const [, em, ed] = parts(event.date);
  const [ty, tm] = parts(today);
  if (event.repeat === 'yearly') {
    const thisYear = key(ty, em, ed);
    return thisYear >= today ? thisYear : key(ty + 1, em, ed);
  }
  const thisMonth = key(ty, tm, ed);
  return thisMonth >= today ? thisMonth : key(ty, tm + 1, ed);
}

/** Yaklaşanlar önce (en yakın başta), geçmiş tek seferlikler sonda. */
export function occurrences(events: readonly CountdownEvent[], today: string): Occurrence[] {
  return events
    .map((event) => {
      const date = nextOccurrence(event, today);
      return { event, date, days: daysBetween(today, date) };
    })
    .sort((a, b) => {
      const ap = a.days < 0;
      const bp = b.days < 0;
      if (ap !== bp) return ap ? 1 : -1;
      return ap ? b.days - a.days : a.days - b.days;
    });
}
