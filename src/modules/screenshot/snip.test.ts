import { describe, expect, it } from 'vitest';
import { dragRect, isUsable, toFractions } from './snip';

describe('snip helpers', () => {
  const bounds = { w: 200, h: 100 };

  it('normalizes drag direction and clamps to bounds', () => {
    expect(dragRect({ x: 50, y: 40 }, { x: 10, y: 10 }, bounds)).toEqual({ x: 10, y: 10, w: 40, h: 30 });
    expect(dragRect({ x: 150, y: 50 }, { x: 400, y: 300 }, bounds)).toEqual({ x: 150, y: 50, w: 50, h: 50 });
  });

  it('rejects tiny selections', () => {
    expect(isUsable({ x: 0, y: 0, w: 3, h: 50 })).toBe(false);
    expect(isUsable({ x: 0, y: 0, w: 30, h: 50 })).toBe(true);
  });

  it('converts to fractions', () => {
    expect(toFractions({ x: 50, y: 25, w: 100, h: 50 }, bounds)).toEqual({ fx: 0.25, fy: 0.25, fw: 0.5, fh: 0.5 });
    expect(toFractions({ x: 0, y: 0, w: 1, h: 1 }, { w: 0, h: 0 })).toBeNull();
  });
});
