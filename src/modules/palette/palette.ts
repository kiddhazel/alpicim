/** Komut paleti: öğe türü ve saf arama/sıralama (birim testli). */

export type PaletteGroup = 'action' | 'panel' | 'workspace' | 'widget' | 'app' | 'bookmark' | 'note';

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  title: string;
  subtitle?: string;
  /** Aramada eşleşen ama gösterilmeyen ek sözcükler. */
  keywords?: string;
  run: () => void | Promise<void>;
}

/** Aksan/büyük-küçük harf duyarsız karşılaştırma için (Türkçe ı/İ dahil). */
export function normalizeText(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function score(item: PaletteItem, words: string[]): number {
  const title = normalizeText(item.title);
  const rest = normalizeText(`${item.subtitle ?? ''} ${item.keywords ?? ''}`);
  let total = 0;
  for (const w of words) {
    if (title.startsWith(w)) total += 3;
    else if (title.split(/\s+/).some((p) => p.startsWith(w))) total += 2;
    else if (title.includes(w)) total += 1;
    else if (rest.includes(w)) total += 0.5;
    else return 0;
  }
  return total;
}

/** Sorguya göre süzer ve sıralar; boş sorguda ilk `limit` öğe olduğu gibi döner. */
export function rankItems(items: readonly PaletteItem[], query: string, limit = 40): PaletteItem[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return items.slice(0, limit);
  return items
    .map((item, index) => ({ item, index, s: score(item, words) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.item);
}
