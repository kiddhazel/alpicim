import { addDays, pad2, parseDateKey, toDateKey, type CalendarEvent } from './calendar';

/**
 * Basit iCalendar (.ics) ayrıştırıcısı: VEVENT, DTSTART/DTEND (UTC, TZID, kayan, tüm gün), SUMMARY, LOCATION,
 * EXDATE ve yalnızca günlük/haftalık RRULE (INTERVAL, COUNT, UNTIL, BYDAY). Saf fonksiyonlar (testli).
 * Çıktı etkinlikleri `source: "ics"` ile salt okunur işaretlenir.
 */

const MAX_OCCURRENCES = 800;
const MAX_ITERATIONS = 4000;
const MAX_SPAN_DAYS = 31;

/** https adresi doğrular (webcal:// → https://). Geçersizse null. */
export function normalizeIcsUrl(raw: string): string | null {
  let text = raw.trim();
  if (/^webcal:\/\//i.test(text)) text = `https://${text.slice(9)}`;
  if (!text || text.length > 2000) return null;
  try {
    const u = new URL(text);
    if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Katlanmış satırları birleştirir ve "ad;param=değer:değer" satırlarını ayırır. */
export function parseLines(text: string): Prop[] {
  const raw = text.replace(/\r\n|\r/g, '\n').split('\n');
  const unfolded: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  const props: Prop[] = [];
  for (const line of unfolded) {
    const colon = findValueColon(line);
    if (colon <= 0) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [name, ...paramParts] = head.split(';');
    const params: Record<string, string> = {};
    for (const part of paramParts) {
      const eq = part.indexOf('=');
      if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '');
    }
    props.push({ name: (name ?? '').toUpperCase(), params, value });
  }
  return props;
}

/** Tırnak içindeki ':' karakterlerini atlayarak değer ayırıcısını bulur. */
function findValueColon(line: string): number {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ':' && !quoted) return i;
  }
  return -1;
}

export function unescapeText(v: string): string {
  return v.replace(/\\([nN,;\\])/g, (_m, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

const DT_RE = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/;

interface Parsed {
  /** Yerel saatte tarih/saat. */
  date: Date;
  allDay: boolean;
}

/** Bir saat diliminde, verilen anın UTC'ye göre farkı (ms). Geçersiz dilim → null. */
function tzOffsetMs(instant: number, tz: string): number | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts: Record<string, number> = {};
    for (const p of fmt.formatToParts(new Date(instant))) {
      if (p.type !== 'literal') parts[p.type] = Number(p.value);
    }
    const asUtc = Date.UTC(parts.year ?? 1970, (parts.month ?? 1) - 1, parts.day ?? 1, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0);
    return asUtc - Math.floor(instant / 1000) * 1000;
  } catch {
    return null;
  }
}

/** "Duvar saati" (y-m-d h:mi:s) verilen dilimdeyken gerçek an. */
export function zonedToDate(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date | null {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off1 = tzOffsetMs(guess, tz);
  if (off1 === null) return null;
  let t = guess - off1;
  const off2 = tzOffsetMs(t, tz);
  if (off2 !== null && off2 !== off1) t = guess - off2;
  return new Date(t);
}

export function parseDateTime(value: string, params: Record<string, string>): Parsed | null {
  const m = DT_RE.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (m[4] === undefined || params.VALUE === 'DATE') {
    const date = new Date(y, mo - 1, d);
    return date.getMonth() === mo - 1 ? { date, allDay: true } : null;
  }
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6] ?? 0);
  if (m[7]) return { date: new Date(Date.UTC(y, mo - 1, d, h, mi, s)), allDay: false };
  const tz = params.TZID;
  if (tz) {
    const zoned = zonedToDate(y, mo, d, h, mi, s, tz);
    if (zoned) return { date: zoned, allDay: false };
  }
  return { date: new Date(y, mo - 1, d, h, mi, s), allDay: false };
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

interface Rule {
  freq: 'DAILY' | 'WEEKLY';
  interval: number;
  count: number | null;
  until: Date | null;
  byDay: number[];
}

export function parseRule(value: string): Rule | null {
  const kv: Record<string, string> = {};
  for (const part of value.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) kv[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  if (kv.FREQ !== 'DAILY' && kv.FREQ !== 'WEEKLY') return null;
  const interval = Math.max(1, Math.min(52, Number(kv.INTERVAL ?? 1) || 1));
  const count = kv.COUNT ? Math.max(1, Number(kv.COUNT) || 1) : null;
  const until = kv.UNTIL ? (parseDateTime(kv.UNTIL, {})?.date ?? null) : null;
  const byDay = (kv.BYDAY ?? '')
    .split(',')
    .map((d) => DAY_CODES.indexOf(d.replace(/^[+-]?\d+/, '').toUpperCase()))
    .filter((i) => i >= 0);
  return { freq: kv.FREQ, interval, count, until, byDay };
}

function timeKey(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

interface RawEvent {
  uid: string;
  summary: string;
  location?: string;
  start: Parsed;
  end: Parsed | null;
  rule: Rule | null;
  exdates: Set<string>;
  cancelled: boolean;
}

function readEvent(props: Prop[], index: number): RawEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const ds = get('DTSTART');
  if (!ds) return null;
  const start = parseDateTime(ds.value, ds.params);
  if (!start) return null;
  const de = get('DTEND');
  const end = de ? parseDateTime(de.value, de.params) : null;
  const rr = get('RRULE');
  const exdates = new Set<string>();
  for (const p of props.filter((x) => x.name === 'EXDATE')) {
    for (const v of p.value.split(',')) {
      const parsed = parseDateTime(v, p.params);
      if (parsed) exdates.add(toDateKey(parsed.date));
    }
  }
  const summary = unescapeText(get('SUMMARY')?.value ?? '').trim();
  const location = unescapeText(get('LOCATION')?.value ?? '').trim();
  return {
    uid: get('UID')?.value.trim() || `ev${index}`,
    summary: summary || '(adsız)',
    location: location || undefined,
    start,
    end,
    rule: rr ? parseRule(rr.value) : null,
    exdates,
    cancelled: get('STATUS')?.value.trim().toUpperCase() === 'CANCELLED',
  };
}

/** Başlangıç günleri (yerel gün anahtarı); en çok MAX_ITERATIONS adım. */
function occurrenceStarts(ev: RawEvent, fromKey: string, toKey: string): Date[] {
  const first = ev.start.date;
  const firstKey = toDateKey(first);
  const out: Date[] = [];
  const at = (key: string): Date => {
    const day = parseDateKey(key);
    if (!day) return first;
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), first.getHours(), first.getMinutes(), first.getSeconds());
  };
  const rule = ev.rule;
  if (!rule) return [first];
  const untilKey = rule.until ? toDateKey(rule.until) : null;
  let produced = 0;
  const accept = (key: string): boolean => {
    if (key < firstKey) return false;
    if (untilKey && key > untilKey) return true; // bitir
    produced++;
    if (!ev.exdates.has(key) && key >= fromKey && key < toKey) out.push(at(key));
    return rule.count !== null && produced >= rule.count;
  };
  if (rule.freq === 'DAILY') {
    let key = firstKey;
    for (let i = 0; i < MAX_ITERATIONS && key < toKey; i++) {
      if (untilKey && key > untilKey) break;
      if (accept(key)) break;
      key = addDays(key, rule.interval);
    }
    return out;
  }
  // WEEKLY: Pazartesi başlangıçlı haftalar; BYDAY yoksa başlangıç günü.
  const days = (rule.byDay.length ? rule.byDay : [first.getDay()]).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const mondayOffset = (first.getDay() + 6) % 7;
  let weekStart = addDays(firstKey, -mondayOffset);
  for (let i = 0; i < MAX_ITERATIONS && weekStart < toKey; i++) {
    let done = false;
    for (const d of days) {
      const key = addDays(weekStart, (d + 6) % 7);
      if (key < firstKey) continue;
      if (untilKey && key > untilKey) {
        done = true;
        break;
      }
      if (accept(key)) {
        done = true;
        break;
      }
    }
    if (done) break;
    weekStart = addDays(weekStart, 7 * rule.interval);
  }
  return out;
}

/** [fromKey, toKey) aralığındaki etkinlik oluşumları (salt okunur, `source: "ics"`). */
export function parseIcs(text: string, fromKey: string, toKey: string): CalendarEvent[] {
  const props = parseLines(text);
  const events: CalendarEvent[] = [];
  let current: Prop[] | null = null;
  let index = 0;
  for (const p of props) {
    if (p.name === 'BEGIN' && p.value.toUpperCase() === 'VEVENT') {
      current = [];
    } else if (p.name === 'END' && p.value.toUpperCase() === 'VEVENT') {
      if (current) {
        const ev = readEvent(current, index++);
        if (ev && !ev.cancelled) events.push(...expand(ev, fromKey, toKey));
      }
      current = null;
    } else if (current) {
      current.push(p);
    }
    if (events.length >= MAX_OCCURRENCES) break;
  }
  return events.slice(0, MAX_OCCURRENCES);
}

function expand(ev: RawEvent, fromKey: string, toKey: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const spanDays =
    ev.start.allDay && ev.end
      ? Math.min(
          MAX_SPAN_DAYS,
          Math.max(1, Math.round((new Date(ev.end.date.getFullYear(), ev.end.date.getMonth(), ev.end.date.getDate()).getTime() - new Date(ev.start.date.getFullYear(), ev.start.date.getMonth(), ev.start.date.getDate()).getTime()) / 86_400_000)),
        )
      : 1;
  for (const start of occurrenceStarts(ev, spanDays > 1 ? addDays(fromKey, -spanDays) : fromKey, toKey)) {
    const baseKey = toDateKey(start);
    for (let i = 0; i < spanDays; i++) {
      const key = i === 0 ? baseKey : addDays(baseKey, i);
      if (key < fromKey || key >= toKey) continue;
      out.push({
        id: `ics:${ev.uid}:${key}`,
        date: key,
        ...(ev.start.allDay ? {} : { time: timeKey(start) }),
        title: ev.summary,
        ...(ev.location ? { location: ev.location } : {}),
        source: 'ics',
      });
    }
  }
  return out;
}
