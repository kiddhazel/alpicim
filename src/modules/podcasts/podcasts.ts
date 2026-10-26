/** Podcast: abonelikler, çalma konumları, hız ve iTunes arama yanıtı (saf mantık). */

export interface PodcastSub {
  /** Akış adresinden türetilir. */
  id: string;
  url: string;
  title: string;
  image: string;
}

export const RATES: readonly number[] = [1, 1.25, 1.5];

/** Boş abonelik listesinde gösterilen öneri aramaları. */
export const SUGGESTED_TERMS: readonly string[] = ['Türkçe sohbet', 'Tarih', 'Teknoloji', 'Girişimcilik', 'Psikoloji', 'Komedi'];

export const MAX_SUBS = 40;

export function normalizeFeedUrl(input: string): string | null {
  let v = input.trim();
  if (!v) return null;
  if (/^feed:\/\//i.test(v)) v = v.replace(/^feed:\/\//i, 'https://');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Kalıcı/izlenebilir kimlik: akış adresinin FNV-1a özeti. */
export function subId(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `p${(h >>> 0).toString(36)}`;
}

export function addSub(subs: readonly PodcastSub[], url: string, title: string, image = ''): PodcastSub[] {
  const norm = normalizeFeedUrl(url);
  if (!norm) return [...subs];
  const id = subId(norm);
  if (subs.some((s) => s.id === id)) return [...subs];
  return [...subs, { id, url: norm, title: title.trim() || norm, image }].slice(-MAX_SUBS);
}

export function removeSub(subs: readonly PodcastSub[], id: string): PodcastSub[] {
  return subs.filter((s) => s.id !== id);
}

export function sanitizeSubs(raw: unknown): PodcastSub[] {
  if (!Array.isArray(raw)) return [];
  let out: PodcastSub[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const url = typeof o.url === 'string' ? normalizeFeedUrl(o.url) : null;
    if (!url) continue;
    const image = typeof o.image === 'string' && o.image.startsWith('https://') ? o.image : '';
    out = addSub(out, url, typeof o.title === 'string' ? o.title : '', image);
  }
  return out;
}

/** bölüm kimliği → saniye */
export type Positions = Record<string, number>;

const MAX_POSITIONS = 500;

function limitPositions(p: Positions): Positions {
  const keys = Object.keys(p);
  if (keys.length <= MAX_POSITIONS) return p;
  return Object.fromEntries(keys.slice(-MAX_POSITIONS).map((k) => [k, p[k] as number]));
}

export function sanitizePositions(raw: unknown): Positions {
  const out: Positions = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k.slice(0, 40)] = Math.floor(v);
  }
  return limitPositions(out);
}

/** Konumu kaydet; başa yakın (<5 sn) ya da sona yakın (<15 sn kala) konumlar silinir. */
export function savePosition(p: Positions, episodeId: string, pos: number, duration: number | null): Positions {
  const next = { ...p };
  delete next[episodeId];
  const finished = duration !== null && duration - pos < 15;
  if (pos >= 5 && !finished) next[episodeId] = Math.floor(pos);
  return limitPositions(next);
}

export function resumeAt(p: Positions, episodeId: string): number {
  return p[episodeId] ?? 0;
}

/** Döngüsel hız geçişi: 1x → 1.25x → 1.5x → 1x. */
export function nextRate(current: number): number {
  const i = RATES.indexOf(current);
  return RATES[(i + 1) % RATES.length] ?? 1;
}

/** http bölüm adresini https'e yükseltmeyi dener (WebView yalnız güvenli akışlara izin verir). */
export function preferHttps(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

export interface PodcastHit {
  title: string;
  author: string;
  feedUrl: string;
  image: string;
}

export function buildItunesUrl(term: string): string {
  const p = new URLSearchParams({ media: 'podcast', entity: 'podcast', country: 'TR', limit: '15', term: term.trim() });
  return `https://itunes.apple.com/search?${p.toString()}`;
}

export function parseItunes(raw: unknown): PodcastHit[] {
  const results = raw && typeof raw === 'object' ? (raw as { results?: unknown }).results : null;
  if (!Array.isArray(results)) return [];
  const out: PodcastHit[] = [];
  for (const r of results) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const feedUrl = typeof o.feedUrl === 'string' ? normalizeFeedUrl(o.feedUrl) : null;
    const title = typeof o.collectionName === 'string' ? o.collectionName.trim() : '';
    if (!feedUrl || !title) continue;
    out.push({
      title,
      author: typeof o.artistName === 'string' ? o.artistName.trim() : '',
      feedUrl,
      image: typeof o.artworkUrl100 === 'string' && o.artworkUrl100.startsWith('https://') ? o.artworkUrl100 : '',
    });
  }
  return out;
}
