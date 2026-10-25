/**
 * Widget ızgarası için saf yerleşim hesapları (React'ten bağımsız, birim testli).
 * Koordinatlar ızgara birimidir: x ∈ [0, cols), genişlik w sütun; y ve h satır.
 * Kurallar:
 * - Hiçbir iki widget çakışmaz.
 * - Sabitlenmiş (locked) widget'lar taşınmaz/itilmez; diğerleri onların altına itilir.
 * - Taşıma/boyutlandırma sonrası boşluklar yukarı doğru sıkıştırılır (sabitlenmişler hariç).
 */

export interface GridItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  locked?: boolean;
}

export interface SizeLimits {
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
}

export const GRID_COLS = 12;

export function collides(a: GridItem, b: GridItem): boolean {
  return a.id !== b.id && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Konumu ve boyutu ızgaraya ve sınırlara sığdırır. */
export function clampItem<T extends GridItem>(item: T, cols = GRID_COLS, limits?: SizeLimits): T {
  const minW = Math.max(1, limits?.minW ?? 1);
  const minH = Math.max(1, limits?.minH ?? 1);
  const maxW = Math.min(cols, limits?.maxW ?? cols);
  const maxH = limits?.maxH ?? 99;
  const w = Math.min(maxW, Math.max(minW, Math.round(item.w)));
  const h = Math.min(maxH, Math.max(minH, Math.round(item.h)));
  const x = Math.min(cols - w, Math.max(0, Math.round(item.x)));
  const y = Math.max(0, Math.round(item.y));
  return { ...item, x, y, w, h };
}

function byPosition(a: GridItem, b: GridItem) {
  return a.y - b.y || a.x - b.x;
}

/** Sabitlenmemiş widget'ları, çakışmadan gidebildikleri en üst satıra taşır. */
export function compact<T extends GridItem>(items: readonly T[]): T[] {
  const placed: T[] = items.filter((i) => i.locked).map((i) => ({ ...i }));
  const free = items.filter((i) => !i.locked).sort(byPosition);
  for (const item of free) {
    const next = { ...item };
    while (next.y > 0 && !placed.some((p) => collides({ ...next, y: next.y - 1 }, p))) next.y--;
    while (placed.some((p) => collides(next, p))) next.y++;
    placed.push(next);
  }
  // Giriş sırasını koru (kalıcı veri gereksiz yere değişmesin).
  return items.map((i) => placed.find((p) => p.id === i.id) as T);
}

/**
 * `activeId` widget'ı yerinde sabit tutarak çakışan diğerlerini aşağı iter.
 * Etkin widget sabitlenmiş bir widget'la çakışıyorsa geçersizdir → null.
 */
export function resolve<T extends GridItem>(items: readonly T[], activeId: string): T[] | null {
  const result = items.map((i) => ({ ...i }));
  const active = result.find((i) => i.id === activeId);
  if (!active) return result;
  if (result.some((o) => o.locked && o.id !== activeId && collides(active, o))) return null;

  const queue: T[] = [active];
  let guard = 0;
  while (queue.length > 0 && guard++ < 10_000) {
    const cur = queue.shift() as T;
    for (const other of [...result].sort(byPosition)) {
      if (other.id === cur.id || other.id === activeId || !collides(cur, other)) continue;
      if (other.locked) {
        // İtilen widget sabit bir widget'a çarptı: onun altına geç.
        cur.y = other.y + other.h;
        queue.push(cur);
        break;
      }
      other.y = cur.y + cur.h;
      queue.push(other);
    }
  }
  return result;
}

/** Widget'ı (x, y) konumuna taşır. Geçersizse orijinal liste döner. */
export function moveItem<T extends GridItem>(items: readonly T[], id: string, x: number, y: number, cols = GRID_COLS): T[] {
  const target = items.find((i) => i.id === id);
  if (!target || target.locked) return [...items];
  const moved = items.map((i) => (i.id === id ? clampItem({ ...i, x, y }, cols, { minW: i.w, minH: i.h, maxW: i.w, maxH: i.h }) : i));
  const resolved = resolve(moved, id);
  return resolved ? compact(resolved) : [...items];
}

/** Widget'ı yeniden boyutlandırır (sınırlar uygulanır). Geçersizse orijinal liste döner. */
export function resizeItem<T extends GridItem>(
  items: readonly T[],
  id: string,
  w: number,
  h: number,
  limits?: SizeLimits,
  cols = GRID_COLS,
): T[] {
  const target = items.find((i) => i.id === id);
  if (!target || target.locked) return [...items];
  const resized = items.map((i) => (i.id === id ? clampItem({ ...i, w, h }, cols, limits) : i));
  const resolved = resolve(resized, id);
  return resolved ? compact(resolved) : [...items];
}

/** w×h boyutunda yeni bir widget için ilk boş konum (yukarıdan aşağı, soldan sağa). */
export function findSpot(items: readonly GridItem[], w: number, h: number, cols = GRID_COLS): { x: number; y: number } {
  const width = Math.min(cols, Math.max(1, w));
  const maxY = items.reduce((m, i) => Math.max(m, i.y + i.h), 0);
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x + width <= cols; x++) {
      const probe = { id: '__probe__', x, y, w: width, h };
      if (!items.some((i) => collides(probe, i))) return { x, y };
    }
  }
  return { x: 0, y: maxY };
}

/** Bozuk/çakışan kayıtlı yerleşimi onarır: sınırlar uygulanır, çakışmalar aşağı itilir, sıkıştırılır. */
export function normalize<T extends GridItem>(items: readonly T[], cols = GRID_COLS): T[] {
  const clamped = items.map((i) => clampItem(i, cols));
  const placed: T[] = [];
  for (const item of [...clamped].sort((a, b) => Number(!!b.locked) - Number(!!a.locked) || byPosition(a, b))) {
    const next = { ...item };
    while (placed.some((p) => collides(next, p))) next.y++;
    placed.push(next);
  }
  const fixed = clamped.map((i) => placed.find((p) => p.id === i.id) as T);
  return compact(fixed);
}

/** Toplam yükseklik (satır). */
export function gridHeight(items: readonly GridItem[]): number {
  return items.reduce((m, i) => Math.max(m, i.y + i.h), 0);
}
