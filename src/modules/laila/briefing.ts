import { t } from '../../i18n';

/** Sabah özeti (saf): önbellekteki veriden kısa cümleler. Ağ isteği yok. */

export const BRIEFING_KEY = 'laila.briefing';

export interface WeatherBrief {
  temp: number;
  code: number;
  min: number | null;
  max: number | null;
}
export interface EventBrief {
  date: string;
  time?: string;
  title: string;
}
export interface BriefingData {
  weather: (WeatherBrief & { desc: string }) | null;
  usd: number | null;
  eur: number | null;
  event: EventBrief | null;
  headline: string | null;
}

export function dayString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Günün ilk açılışı ve 05:00–12:00 arası mı? */
export function shouldBrief(now: Date, lastDay: string | null): boolean {
  return now.getHours() >= 5 && now.getHours() < 12 && lastDay !== dayString(now);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** `weather.cache`: en yeni kayıt. */
export function pickWeather(raw: unknown): WeatherBrief | null {
  if (!isObj(raw)) return null;
  let best: Record<string, unknown> | null = null;
  for (const v of Object.values(raw)) {
    if (!isObj(v) || typeof v.temperature !== 'number' || typeof v.code !== 'number') continue;
    const at = typeof v.fetchedAt === 'number' ? v.fetchedAt : 0;
    if (!best || at > (typeof best.fetchedAt === 'number' ? best.fetchedAt : 0)) best = v;
  }
  if (!best) return null;
  const first = Array.isArray(best.daily) && isObj(best.daily[0]) ? best.daily[0] : null;
  return {
    temp: best.temperature as number,
    code: best.code as number,
    min: first && typeof first.min === 'number' ? first.min : null,
    max: first && typeof first.max === 'number' ? first.max : null,
  };
}

/** `markets.cache`: TCMB referans kurları (USD/TRY, EUR/TRY). */
export function pickRates(raw: unknown): { usd: number | null; eur: number | null } {
  const out = { usd: null as number | null, eur: null as number | null };
  const data = isObj(raw) && isObj(raw.reference) && Array.isArray(raw.reference.data) ? raw.reference.data : [];
  for (const q of data) {
    if (!isObj(q) || typeof q.price !== 'number') continue;
    if (q.symbol === 'USD/TRY') out.usd = q.price;
    if (q.symbol === 'EUR/TRY') out.eur = q.price;
  }
  return out;
}

/** `workspaces` anahtarı: takvim widget'larındaki sıradaki etkinlik (bugünden sonra veya bugün henüz geçmemiş). */
export function nextEvent(raw: unknown, today: string, nowHm: string): EventBrief | null {
  const items = isObj(raw) && Array.isArray(raw.items) ? raw.items : [];
  let best: EventBrief | null = null;
  const key = (x: EventBrief) => `${x.date} ${x.time ?? '00:00'}`;
  for (const ws of items) {
    const widgets = isObj(ws) && Array.isArray(ws.widgets) ? ws.widgets : [];
    for (const w of widgets) {
      if (!isObj(w) || w.type !== 'calendar' || !isObj(w.config) || !Array.isArray(w.config.events)) continue;
      for (const e of w.config.events) {
        if (!isObj(e) || typeof e.date !== 'string' || typeof e.title !== 'string') continue;
        const time = typeof e.time === 'string' && /^\d{2}:\d{2}$/.test(e.time) ? e.time : undefined;
        if (e.date < today || (e.date === today && time !== undefined && time < nowHm)) continue;
        const cand: EventBrief = { date: e.date, time, title: e.title };
        if (!best || key(cand) < key(best)) best = cand;
      }
    }
  }
  return best;
}

/** `news.cache`: en yeni haberin başlığı. */
export function topHeadline(raw: unknown): string | null {
  if (!isObj(raw)) return null;
  let best: { title: string; at: number } | null = null;
  for (const feed of Object.values(raw)) {
    const items = isObj(feed) && Array.isArray(feed.items) ? feed.items : [];
    for (const it of items) {
      if (!isObj(it) || typeof it.title !== 'string') continue;
      const at = typeof it.publishedAt === 'number' ? it.publishedAt : 0;
      if (!best || at > best.at) best = { title: it.title, at };
    }
  }
  if (!best) return null;
  return best.title.length > 100 ? `${best.title.slice(0, 97)}…` : best.title;
}

const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function eventWhen(e: EventBrief, today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const tomorrow = y && m && d ? dayString(new Date(y, m - 1, d + 1)) : '';
  const day =
    e.date === today ? t('laila.briefing.today') : e.date === tomorrow ? t('laila.briefing.tomorrow') : e.date.split('-').reverse().join('.');
  return e.time ? `${day} ${e.time}` : day;
}

/** Ardışık balonlar için cümleler. */
export function briefingLines(data: BriefingData, today: string): string[] {
  const out: string[] = [t('laila.briefing.intro')];
  const w = data.weather;
  if (w) {
    out.push(
      t(w.min !== null && w.max !== null ? 'laila.briefing.weatherRange' : 'laila.briefing.weather', {
        temp: Math.round(w.temp),
        desc: w.desc,
        min: w.min === null ? '' : Math.round(w.min),
        max: w.max === null ? '' : Math.round(w.max),
      }),
    );
  }
  if (data.usd !== null && data.eur !== null) out.push(t('laila.briefing.rates', { usd: money(data.usd), eur: money(data.eur) }));
  else if (data.usd !== null) out.push(t('laila.briefing.usd', { usd: money(data.usd) }));
  else if (data.eur !== null) out.push(t('laila.briefing.eur', { eur: money(data.eur) }));
  if (data.event) out.push(t('laila.briefing.event', { title: data.event.title, when: eventWhen(data.event, today) }));
  if (data.headline) out.push(t('laila.briefing.headline', { title: data.headline }));
  if (out.length === 1) out.push(t('laila.briefing.empty'));
  return out.slice(0, 5);
}
