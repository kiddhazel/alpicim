import { obj } from '../types';

export interface CalendarEvent {
  id: string;
  /** YYYY-MM-DD (yerel gün). */
  date: string;
  /** HH:MM (isteğe bağlı). */
  time?: string;
  title: string;
  /** Yalnızca .ics aboneliğinden gelen salt okunur etkinliklerde ("ics"); depoya yazılmaz. */
  source?: 'ics';
  location?: string;
}

export interface CalendarConfig {
  events: CalendarEvent[];
}

export const MAX_EVENTS = 300;
export const calendarDefaults: CalendarConfig = { events: [] };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Geçerli bir takvim günüyse Date (yerel öğle değil gece yarısı), değilse null. */
export function parseDateKey(key: string): Date | null {
  const m = DATE_RE.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const d = new Date(y, mo - 1, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null;
  return d;
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key) ?? new Date();
  return toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

export function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const d = new Date(year, month + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export interface MonthCell {
  date: string;
  day: number;
  inMonth: boolean;
}

/** Pazartesi başlangıçlı 6x7 ay matrisi (month: 0-11). */
export function monthMatrix(year: number, month: number): MonthCell[][] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const rows: MonthCell[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: MonthCell[] = [];
    for (let c = 0; c < 7; c++) {
      const d = new Date(year, month, 1 - offset + r * 7 + c);
      row.push({ date: toDateKey(d), day: d.getDate(), inMonth: d.getMonth() === month });
    }
    rows.push(row);
  }
  return rows;
}

export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const at = a.time ?? '99:99';
  const bt = b.time ?? '99:99';
  if (at !== bt) return at < bt ? -1 : 1;
  return a.title.localeCompare(b.title, 'tr');
}

export function sortEvents(events: readonly CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(compareEvents);
}

export function eventsOn(events: readonly CalendarEvent[], date: string): CalendarEvent[] {
  return sortEvents(events.filter((e) => e.date === date));
}

export function datesWithEvents(events: readonly CalendarEvent[]): Set<string> {
  return new Set(events.map((e) => e.date));
}

/** [today, today + days) aralığındaki etkinlikler, sıralı. */
export function upcoming(events: readonly CalendarEvent[], today: string, days = 7, limit = 50): CalendarEvent[] {
  const end = addDays(today, days);
  return sortEvents(events.filter((e) => e.date >= today && e.date < end)).slice(0, limit);
}

export function newEventId(): string {
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Etkinlik ekler; geçersizse ya da sınır doluysa listeyi değiştirmez. */
export function addEvent(events: readonly CalendarEvent[], date: string, time: string, title: string): CalendarEvent[] {
  const clean = title.trim().slice(0, 120);
  if (!clean || !parseDateKey(date) || events.length >= MAX_EVENTS) return [...events];
  const ev: CalendarEvent = { id: newEventId(), date, title: clean };
  if (TIME_RE.test(time)) ev.time = time;
  return [...events, ev];
}

export function removeEvent(events: readonly CalendarEvent[], id: string): CalendarEvent[] {
  return events.filter((e) => e.id !== id);
}

export function sanitizeCalendar(raw: unknown): CalendarConfig {
  const list = obj(raw).events;
  if (!Array.isArray(list)) return { events: [] };
  const seen = new Set<string>();
  const events: CalendarEvent[] = [];
  for (const item of list) {
    if (events.length >= MAX_EVENTS) break;
    const r = obj(item);
    const id = typeof r.id === 'string' ? r.id.slice(0, 40) : '';
    const date = typeof r.date === 'string' ? r.date : '';
    const title = typeof r.title === 'string' ? r.title.trim().slice(0, 120) : '';
    if (!id || seen.has(id) || !title || !parseDateKey(date)) continue;
    seen.add(id);
    const ev: CalendarEvent = { id, date, title };
    if (typeof r.time === 'string' && TIME_RE.test(r.time)) ev.time = r.time;
    events.push(ev);
  }
  return { events };
}
