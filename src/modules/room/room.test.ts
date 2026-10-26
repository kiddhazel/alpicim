import { describe, expect, it } from 'vitest';
import { EMPTY_ACHIEVEMENTS } from '../achievements/achievements';
import { bondPoints, daypartFrom, placedFurniture, sanitizeRoom, toggleFurniture, unlockedFurniture } from './room';

describe('room', () => {
  it('puanla ve rozetle eşya açılır', () => {
    expect(unlockedFurniture(0, EMPTY_ACHIEVEMENTS)).toEqual(['rug']);
    expect(unlockedFurniture(100, EMPTY_ACHIEVEMENTS)).toEqual(['rug', 'bed', 'plant', 'aquarium']);
    const ach = { counters: {}, unlocked: { wordle: 1 } };
    expect(unlockedFurniture(0, ach)).toContain('poster');
  });

  it('gizlenen eşya yerleşmez; geri açılabilir', () => {
    let layout = toggleFurniture({ hidden: [] }, 'bed');
    expect(placedFurniture(50, EMPTY_ACHIEVEMENTS, layout)).toEqual(['rug', 'plant']);
    layout = toggleFurniture(layout, 'bed');
    expect(placedFurniture(50, EMPTY_ACHIEVEMENTS, layout)).toContain('bed');
  });

  it('bozuk veriyi temizler', () => {
    expect(sanitizeRoom({ hidden: ['bed', 'bed', 'x', 3] })).toEqual({ hidden: ['bed'] });
    expect(sanitizeRoom(null)).toEqual({ hidden: [] });
    expect(bondPoints({ points: 12.9 })).toBe(12);
    expect(bondPoints('x')).toBe(0);
    expect(daypartFrom('night')).toBe('night');
    expect(daypartFrom(undefined)).toBe('day');
  });
});
