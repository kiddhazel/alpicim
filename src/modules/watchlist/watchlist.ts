/** Film/dizi listesi ve "Bu akşam ne izlesem?" çarkı (saf mantık). */

export type WatchKind = 'film' | 'dizi';
export type WatchStatus = 'planned' | 'watching' | 'done';

export interface WatchItem {
  id: string;
  title: string;
  kind: WatchKind;
  status: WatchStatus;
  season: number;
  episode: number;
}

export const WATCH_KINDS: readonly WatchKind[] = ['film', 'dizi'];
export const WATCH_STATUSES: readonly WatchStatus[] = ['planned', 'watching', 'done'];
export const MAX_ITEMS = 200;

export interface WatchlistState {
  items: WatchItem[];
}

export function defaultWatchlist(): WatchlistState {
  return { items: [] };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.floor(v), min), max) : fallback;
}

export function sanitizeWatchlist(raw: unknown): WatchlistState {
  const rawItems = raw && typeof raw === 'object' ? (raw as { items?: unknown }).items : null;
  if (!Array.isArray(rawItems)) return defaultWatchlist();
  const items: WatchItem[] = [];
  const seen = new Set<string>();
  for (const r of rawItems) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.slice(0, 40) : '';
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 80) : '';
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title,
      kind: o.kind === 'dizi' ? 'dizi' : 'film',
      status: WATCH_STATUSES.includes(o.status as WatchStatus) ? (o.status as WatchStatus) : 'planned',
      season: clampInt(o.season, 1, 99, 1),
      episode: clampInt(o.episode, 0, 999, 0),
    });
  }
  return { items: items.slice(0, MAX_ITEMS) };
}

export function addItem(items: readonly WatchItem[], title: string, kind: WatchKind, id: string): WatchItem[] {
  const clean = title.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!clean || items.length >= MAX_ITEMS) return [...items];
  if (items.some((i) => i.title.toLocaleLowerCase('tr') === clean.toLocaleLowerCase('tr') && i.kind === kind)) return [...items];
  return [...items, { id, title: clean, kind, status: 'planned', season: 1, episode: 0 }];
}

export function removeItem(items: readonly WatchItem[], id: string): WatchItem[] {
  return items.filter((i) => i.id !== id);
}

export function setStatus(items: readonly WatchItem[], id: string, status: WatchStatus): WatchItem[] {
  return items.map((i) => (i.id === id ? { ...i, status } : i));
}

/** Bölüm sayacını değiştirir; ilk bölüm artışı "izleniyor" yapar. Filmlerde etkisizdir. */
export function bumpEpisode(items: readonly WatchItem[], id: string, delta: number): WatchItem[] {
  return items.map((i) => {
    if (i.id !== id || i.kind !== 'dizi') return i;
    const episode = clampInt(i.episode + delta, 0, 999, i.episode);
    const status: WatchStatus = delta > 0 && i.status === 'planned' ? 'watching' : i.status;
    return { ...i, episode, status };
  });
}

/** Yeni sezona geçer: sezon + 1, bölüm 0. */
export function nextSeason(items: readonly WatchItem[], id: string): WatchItem[] {
  return items.map((i) => (i.id === id && i.kind === 'dizi' ? { ...i, season: clampInt(i.season + 1, 1, 99, i.season), episode: 0 } : i));
}

export function planned(items: readonly WatchItem[]): WatchItem[] {
  return items.filter((i) => i.status === 'planned');
}

export function progressLabel(item: WatchItem): string {
  return item.kind === 'dizi' ? `S${item.season} B${item.episode}` : '';
}

/**
 * Çark dizisi: `count` seçenek arasında, `winner` dizinde biten kare dizisi.
 * Her zaman `rounds` tam tur + kazanana kadar gider (dizinin son elemanı kazanan).
 */
export function spinSequence(count: number, winner: number, rounds = 3): number[] {
  if (count < 1) return [];
  const w = Math.min(Math.max(Math.floor(winner), 0), count - 1);
  const total = rounds * count + w + 1;
  return Array.from({ length: total }, (_, i) => i % count);
}

/** Kare gecikmeleri (ms): hızlı başlar, sona doğru yavaşlar. */
export function spinDelays(frames: number, fastMs = 45, slowMs = 380): number[] {
  return Array.from({ length: frames }, (_, i) => {
    const p = frames <= 1 ? 1 : i / (frames - 1);
    return Math.round(fastMs + (slowMs - fastMs) * p * p * p);
  });
}

/** `rnd` [0,1) → kazanan dizin. */
export function pickWinner(count: number, rnd: number = Math.random()): number {
  if (count < 1) return -1;
  return Math.floor(Math.min(Math.max(rnd, 0), 0.999999) * count);
}
