import type { NewsItem } from './types';

const STOP_WORDS = new Set([
  've', 'ile', 'bir', 'bu', 'da', 'de', 'için', 'icin', 'mi', 'mı', 'ne', 'o', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'and',
]);

/** Başlığı karşılaştırma için sadeleştirir: küçük harf, aksansız, noktalamasız. */
export function normalizeTitle(title: string): string {
  return title
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter((w) => w.length > 1 && !STOP_WORDS.has(w)));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

function canonicalLink(link: string): string {
  try {
    const url = new URL(link);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_') || key === 'oc') url.searchParams.delete(key);
    }
    return `${url.host.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}${url.search}`;
  } catch {
    return link;
  }
}

/** Benzerlik eşiği: bu orandan fazla ortak kelime içeren başlıklar aynı haber sayılır. */
export const SIMILARITY_THRESHOLD = 0.72;

/**
 * Tekrarlanan haberleri ayıklar. En yeni öğe tutulur; aynı haberi veren diğer kaynaklar
 * `alsoIn` alanına eklenir. Aynı bağlantı, aynı başlık veya çok benzer başlık tekrar sayılır.
 */
export function dedupeNews(items: readonly NewsItem[]): NewsItem[] {
  const sorted = [...items].sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  const kept: Array<{ item: NewsItem; norm: string; toks: Set<string>; link: string }> = [];
  const byLink = new Map<string, number>();
  const byTitle = new Map<string, number>();

  for (const item of sorted) {
    const norm = normalizeTitle(item.title);
    const link = canonicalLink(item.link);
    let match = byLink.get(link) ?? byTitle.get(norm);

    const toks = tokens(norm);
    if (match === undefined && toks.size >= 4) {
      match = kept.findIndex((k) => k.toks.size >= 4 && jaccard(k.toks, toks) >= SIMILARITY_THRESHOLD);
      if (match < 0) match = undefined;
    }

    if (match !== undefined) {
      const target = kept[match];
      if (target && target.item.source !== item.source) {
        const also = new Set(target.item.alsoIn ?? []);
        also.add(item.source);
        target.item = { ...target.item, alsoIn: [...also] };
      }
      continue;
    }

    const index = kept.length;
    kept.push({ item: { ...item }, norm, toks, link });
    byLink.set(link, index);
    byTitle.set(norm, index);
  }

  return kept.map((k) => k.item);
}
