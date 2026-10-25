import { describe, expect, it } from 'vitest';
import { clampItem, collides, compact, findSpot, moveItem, normalize, resizeItem, type GridItem } from './grid';

const noOverlap = (items: GridItem[]) => {
  for (const a of items) for (const b of items) if (collides(a, b)) return false;
  return true;
};

describe('widget ızgarası', () => {
  it('çakışmayı algılar', () => {
    expect(collides({ id: 'a', x: 0, y: 0, w: 2, h: 2 }, { id: 'b', x: 1, y: 1, w: 2, h: 2 })).toBe(true);
    expect(collides({ id: 'a', x: 0, y: 0, w: 2, h: 2 }, { id: 'b', x: 2, y: 0, w: 2, h: 2 })).toBe(false);
  });

  it('sınırları uygular', () => {
    expect(clampItem({ id: 'a', x: 11, y: -3, w: 4, h: 0 })).toEqual({ id: 'a', x: 8, y: 0, w: 4, h: 1 });
    expect(clampItem({ id: 'a', x: 0, y: 0, w: 1, h: 9 }, 12, { minW: 2, minH: 2, maxW: 6, maxH: 4 })).toMatchObject({ w: 2, h: 4 });
  });

  it('boşlukları yukarı sıkıştırır', () => {
    const out = compact([
      { id: 'a', x: 0, y: 3, w: 2, h: 2 },
      { id: 'b', x: 0, y: 8, w: 2, h: 2 },
    ]);
    expect(out.map((i) => i.y)).toEqual([0, 2]);
  });

  it('taşınan widget çakıştığı widget\'ı aşağı iter', () => {
    const items = [
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 4, y: 0, w: 4, h: 2 },
    ];
    const out = moveItem(items, 'b', 0, 0);
    expect(noOverlap(out)).toBe(true);
    expect(out.find((i) => i.id === 'b')).toMatchObject({ x: 0, y: 0 });
    expect(out.find((i) => i.id === 'a')).toMatchObject({ x: 0, y: 2 });
  });

  it('sabitlenmiş widget yerinden oynamaz; üstüne taşıma reddedilir', () => {
    const items = [
      { id: 'pin', x: 0, y: 0, w: 4, h: 2, locked: true },
      { id: 'b', x: 4, y: 0, w: 4, h: 2 },
    ];
    expect(moveItem(items, 'b', 2, 0)).toEqual(items);
    expect(moveItem(items, 'pin', 6, 6)).toEqual(items);
  });

  it('itilen widget sabitlenmiş widget\'ın altına geçer', () => {
    const items = [
      { id: 'pin', x: 0, y: 2, w: 6, h: 2, locked: true },
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'c', x: 6, y: 0, w: 6, h: 2 },
    ];
    const out = moveItem(items, 'c', 0, 0);
    expect(noOverlap(out)).toBe(true);
    expect(out.find((i) => i.id === 'pin')).toMatchObject({ x: 0, y: 2 });
    expect(out.find((i) => i.id === 'a')?.y).toBeGreaterThanOrEqual(4);
  });

  it('boyutlandırma sınırlara uyar ve çakışmayı çözer', () => {
    const items = [
      { id: 'a', x: 0, y: 0, w: 3, h: 2 },
      { id: 'b', x: 3, y: 0, w: 3, h: 2 },
    ];
    const out = resizeItem(items, 'a', 20, 3, { minW: 2, minH: 2, maxW: 6, maxH: 4 });
    expect(out.find((i) => i.id === 'a')).toMatchObject({ w: 6, h: 3 });
    expect(noOverlap(out)).toBe(true);
  });

  it('yeni widget için boş yer bulur', () => {
    const items = [
      { id: 'a', x: 0, y: 0, w: 6, h: 2 },
      { id: 'b', x: 6, y: 0, w: 4, h: 2 },
    ];
    expect(findSpot(items, 2, 2)).toEqual({ x: 10, y: 0 });
    expect(findSpot(items, 4, 2)).toEqual({ x: 0, y: 2 });
  });

  it('bozuk kayıtlı yerleşimi onarır', () => {
    const out = normalize([
      { id: 'a', x: 0, y: 0, w: 4, h: 2 },
      { id: 'b', x: 2, y: 0, w: 4, h: 2 },
      { id: 'c', x: 40, y: -5, w: 30, h: 2 },
    ]);
    expect(noOverlap(out)).toBe(true);
    expect(out.every((i) => i.x >= 0 && i.x + i.w <= 12 && i.y >= 0)).toBe(true);
  });
});
