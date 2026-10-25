import { mapLimit, netGetOk } from '../../shared/lib/net';
import { readKey, writeKey } from '../../shared/lib/store';
import { AppError, toAppError } from '../../shared/lib/tauri';
import { isIntegrationEnabled } from '../integrations/integrationsService';
import { dedupeNews, normalizeTitle } from './dedupe';
import { DEFAULT_FEEDS } from './defaultFeeds';
import { parseFeed } from './rss';
import { isNewsCategory, type Feed, type FeedCache, type FeedCacheEntry, type NewsCategory, type NewsFilter, type NewsItem } from './types';

export const KEYS = {
  feeds: 'news.feeds',
  cache: 'news.cache',
  bookmarks: 'news.bookmarks',
  read: 'news.read',
} as const;

/** Aynı kaynağa iki istek arasında en az bu kadar süre geçmeli (zorla yenilemede de). */
export const MIN_FETCH_GAP_MS = 60_000;
const MAX_READ_IDS = 4000;
const MAX_BOOKMARKS = 500;

// ---------------------------------------------------------------------------
// Kaynak listesi
// ---------------------------------------------------------------------------

export function sanitizeFeeds(raw: unknown): Feed[] {
  if (!Array.isArray(raw)) return [...DEFAULT_FEEDS];
  const feeds: Feed[] = [];
  for (const f of raw as Array<Partial<Feed>>) {
    if (!f || typeof f.id !== 'string' || typeof f.url !== 'string' || !isNewsCategory(f.category)) continue;
    feeds.push({
      id: f.id,
      name: typeof f.name === 'string' && f.name ? f.name : f.url,
      url: f.url,
      category: f.category,
      enabled: f.enabled !== false,
      builtin: f.builtin === true,
    });
  }
  // Yeni sürümle eklenen yerleşik kaynakları listeye kat (kullanıcı silemeyeceği için).
  for (const def of DEFAULT_FEEDS) {
    if (!feeds.some((f) => f.id === def.id)) feeds.push({ ...def });
  }
  return feeds;
}

/** Google Haberler entegrasyonu kapalıysa yerleşik (Google) kaynaklar kapalı sayılır; kullanıcı listesi değişmez. */
export function effectiveFeeds(feeds: readonly Feed[], googleNewsEnabled: boolean): Feed[] {
  return googleNewsEnabled ? [...feeds] : feeds.map((f) => (f.builtin && f.enabled ? { ...f, enabled: false } : f));
}

export function validateFeedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'feeds.invalidProtocol';
    return null;
  } catch {
    return 'feeds.invalidUrl';
  }
}

export function createFeed(name: string, url: string, category: NewsCategory): Feed {
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: name.trim() || new URL(url).host,
    url: url.trim(),
    category,
    enabled: true,
    builtin: false,
  };
}

/** Eklemeden önce kaynağı bir kez indirip ayrıştırır; kaç haber bulunduğunu döndürür. */
export async function probeFeed(url: string, category: NewsCategory): Promise<number> {
  const res = await netGetOk({ url });
  const items = parseFeed(res.body, { id: 'probe', name: url, category });
  if (items.length === 0) throw new AppError('PARSE', 'Akışta haber bulunamadı');
  return items.length;
}

// ---------------------------------------------------------------------------
// İndirme ve önbellek
// ---------------------------------------------------------------------------

export async function loadCache(): Promise<FeedCache> {
  const raw = await readKey<FeedCache>(KEYS.cache, {});
  return raw && typeof raw === 'object' ? raw : {};
}

interface RefreshOptions {
  /** Bu süreden yeni önbellekler yeniden indirilmez. */
  maxAgeMs: number;
  /** Kullanıcı "Yenile" dedi: maxAge yok sayılır (MIN_FETCH_GAP_MS yine uygulanır). */
  force?: boolean;
}

function isFresh(entry: FeedCacheEntry | undefined, opts: RefreshOptions, now: number): boolean {
  if (!entry) return false;
  const last = Math.max(entry.fetchedAt, entry.attemptedAt);
  if (now - last < MIN_FETCH_GAP_MS) return true;
  if (opts.force) return false;
  return now - entry.fetchedAt < opts.maxAgeMs && !entry.error;
}

async function fetchOne(feed: Feed, previous: FeedCacheEntry | undefined, now: number): Promise<FeedCacheEntry> {
  try {
    const res = await netGetOk({
      url: feed.url,
      etag: previous?.etag ?? null,
      lastModified: previous?.lastModified ?? null,
    });
    if (res.notModified && previous) {
      return { ...previous, fetchedAt: now, attemptedAt: now, error: null };
    }
    const items = parseFeed(res.body, feed);
    return {
      feedId: feed.id,
      fetchedAt: now,
      attemptedAt: now,
      etag: res.etag,
      lastModified: res.lastModified,
      items,
      error: null,
    };
  } catch (err) {
    const e = toAppError(err);
    // Eski içerik korunur; hata ayrıca işaretlenir.
    return {
      feedId: feed.id,
      fetchedAt: previous?.fetchedAt ?? 0,
      attemptedAt: now,
      etag: previous?.etag ?? null,
      lastModified: previous?.lastModified ?? null,
      items: previous?.items ?? [],
      error: e.code === 'UNKNOWN' && e.detail ? e.detail : e.code,
    };
  }
}

/**
 * Etkin kaynakları gerektiği kadar yeniler ve önbelleği kaydeder.
 * Taze olanlar atlanır; aynı anda en fazla 3 istek yapılır; koşullu istek (ETag) kullanılır.
 */
export async function refreshFeeds(feeds: readonly Feed[], opts: RefreshOptions): Promise<FeedCache> {
  const now = Date.now();
  const cache = await loadCache();
  // Çağıran süzmemiş olsa bile kapatılmış entegrasyona istek gitmesin.
  const active = effectiveFeeds(feeds, await isIntegrationEnabled('googlenews'));
  const due = active.filter((f) => f.enabled && !isFresh(cache[f.id], opts, now));

  if (due.length > 0) {
    const results = await mapLimit(due, 3, (feed) => fetchOne(feed, cache[feed.id], now));
    for (const entry of results) cache[entry.feedId] = entry;
  }

  // Artık listede olmayan kaynakların önbelleğini temizle.
  const ids = new Set(feeds.map((f) => f.id));
  for (const id of Object.keys(cache)) if (!ids.has(id)) delete cache[id];

  if (due.length > 0) await writeKey(KEYS.cache, cache);
  return cache;
}

// ---------------------------------------------------------------------------
// Görünüm için birleştirme ve filtreleme
// ---------------------------------------------------------------------------

export interface NewsQuery {
  category: NewsCategory | 'all';
  filter: NewsFilter;
  search: string;
}

export function aggregate(
  feeds: readonly Feed[],
  cache: FeedCache,
  bookmarks: readonly NewsItem[],
  readIds: ReadonlySet<string>,
  query: NewsQuery,
): NewsItem[] {
  const enabled = new Set(feeds.filter((f) => f.enabled).map((f) => f.id));
  let items: NewsItem[] =
    query.filter === 'bookmarks'
      ? [...bookmarks]
      : dedupeNews(Object.values(cache).flatMap((e) => (enabled.has(e.feedId) ? e.items : [])));

  if (query.category !== 'all') items = items.filter((i) => i.category === query.category);
  if (query.filter === 'unread') items = items.filter((i) => !readIds.has(i.id));

  const q = normalizeTitle(query.search);
  if (q) {
    const words = q.split(' ');
    items = items.filter((i) => {
      const hay = normalizeTitle(`${i.title} ${i.source} ${i.summary}`);
      return words.every((w) => hay.includes(w));
    });
  }
  return items;
}

/** Kategori başına (tekrar ayıklanmış) haber sayısı. */
export function countByCategory(feeds: readonly Feed[], cache: FeedCache): Record<string, number> {
  const enabled = new Set(feeds.filter((f) => f.enabled).map((f) => f.id));
  const all = dedupeNews(Object.values(cache).flatMap((e) => (enabled.has(e.feedId) ? e.items : [])));
  const counts: Record<string, number> = { all: all.length };
  for (const item of all) counts[item.category] = (counts[item.category] ?? 0) + 1;
  return counts;
}

export function trimReadIds(ids: readonly string[]): string[] {
  return ids.length > MAX_READ_IDS ? ids.slice(ids.length - MAX_READ_IDS) : [...ids];
}

export function toggleBookmark(list: readonly NewsItem[], item: NewsItem): NewsItem[] {
  if (list.some((b) => b.id === item.id)) return list.filter((b) => b.id !== item.id);
  return [{ ...item, alsoIn: undefined }, ...list].slice(0, MAX_BOOKMARKS);
}
