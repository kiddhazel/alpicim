import { formatNumber, formatPercent } from '../../shared/lib/time';
import type { MarketCache } from '../markets/marketService';
import type { Quote } from '../markets/types';
import type { NewsCategory, NewsItem } from '../news/types';
import type { TickerSpeed } from '../settings/settings';

/** Şeritte gösterilecek en fazla fiyat ve haber sayısı. */
export const MAX_CHIPS = 6;
export const MAX_HEADLINES = 15;
/** Kayan yazı hızı (px/sn) ve karakter başına yaklaşık genişlik (px). */
export const MARQUEE_SPEEDS: Record<TickerSpeed, number> = { slow: 35, normal: 60, fast: 95 };
export const MARQUEE_CHAR_PX = 8;
export const MARQUEE_MIN_SEC = 20;
/** Hareketsiz kipte başlığın değişme aralığı. */
export const ROTATE_MS = 6000;

/**
 * Önbellekteki fiyatlardan şerit için seçim: referans kurlar → altın → canlı → izleme listesi.
 * Aynı anahtar tekrarlanmaz; veri yoksa boş döner (uydurma değer üretilmez).
 */
export function selectQuotes(cache: MarketCache, max = MAX_CHIPS): Quote[] {
  if (max <= 0) return [];
  const watch = Object.values(cache.watch).flatMap((s) => (s.data ? [s.data] : []));
  const all = [
    ...(cache.reference?.data ?? []),
    ...(cache.gold?.data ?? []),
    ...(cache.live?.data ?? []),
    ...watch,
  ];
  const seen = new Set<string>();
  const out: Quote[] = [];
  for (const q of all) {
    if (seen.has(q.key) || !Number.isFinite(q.price)) continue;
    seen.add(q.key);
    out.push(q);
    if (out.length >= max) break;
  }
  return out;
}

/** En yeni haberler önce (tarihsiz olanlar sona), en fazla `max` adet. */
export function selectHeadlines(
  items: readonly NewsItem[],
  max = MAX_HEADLINES,
  category: NewsCategory | 'all' = 'all',
): NewsItem[] {
  return items
    .filter((i) => i.title.trim() !== '' && (category === 'all' || i.category === category))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const pa = a.item.publishedAt;
      const pb = b.item.publishedAt;
      if (pa === null && pb === null) return a.index - b.index;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return pb - pa || a.index - b.index;
    })
    .slice(0, max)
    .map((x) => x.item);
}

export function formatQuotePrice(q: Pick<Quote, 'price'>): string {
  return formatNumber(q.price, q.price >= 1000 ? 2 : 4);
}

export type ChangeTone = 'up' | 'down' | 'flat' | 'none';

export function changeTone(q: Pick<Quote, 'changePct' | 'change'>): ChangeTone {
  const v = q.changePct ?? q.change;
  if (v === null || !Number.isFinite(v)) return 'none';
  return v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
}

/** "+0,35%" ya da değişim yoksa null. */
export function formatChange(q: Pick<Quote, 'changePct'>): string | null {
  return q.changePct !== null && Number.isFinite(q.changePct) ? formatPercent(q.changePct) : null;
}

/** Kayan yazının bir turunun süresi (sn): içerik uzunluğu ile orantılı, alt sınırlı. */
export function marqueeDurationSec(totalChars: number, speed: TickerSpeed = 'normal'): number {
  const px = Math.max(0, totalChars) * MARQUEE_CHAR_PX;
  return Math.max(MARQUEE_MIN_SEC, Math.round(px / MARQUEE_SPEEDS[speed]));
}

/** Başlık listesinin toplam karakter sayısı (kaynak adı ve ayırıcı payı dahil). */
export function headlineChars(items: readonly Pick<NewsItem, 'title' | 'source'>[]): number {
  return items.reduce((sum, i) => sum + i.title.length + i.source.length + 6, 0);
}

/** Döngüsel sonraki dizin. */
export function nextIndex(index: number, length: number): number {
  return length <= 0 ? 0 : (index + 1) % length;
}
