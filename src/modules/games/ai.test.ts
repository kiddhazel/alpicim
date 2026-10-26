import { describe, expect, it } from 'vitest';
import { chooseMemoryCard, chooseSnakeDir, choose2048, observeCard } from './ai';
import { emptyBoard } from './g2048';
import { newMemory } from './memory';
import { initSnake } from './snake';

describe('Laila otomatik oyun', () => {
  it('2048: yalnızca geçerli hamle seçer', () => {
    const b = emptyBoard();
    (b[0] as number[])[0] = 2;
    const d = choose2048(b);
    expect(d === 'right' || d === 'down').toBe(true);
    const full = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
    expect(choose2048(full)).toBeNull();
  });
  it('yılan: yemeğe yönelir, duvardan kaçınır', () => {
    const s = initSnake(10, 10, () => 0);
    const head = s.body[0] ?? { x: 0, y: 0 };
    expect(chooseSnakeDir({ ...s, food: { x: head.x + 3, y: head.y } })).toBe('right');
    expect(chooseSnakeDir({ ...s, food: { x: head.x, y: head.y - 3 } })).toBe('up');
    const edge = { ...s, body: [{ x: 9, y: 5 }, { x: 8, y: 5 }], food: { x: 0, y: 0 } };
    expect(chooseSnakeDir(edge)).not.toBe('right');
  });
  it('hafıza: bilinen eşi çevirir', () => {
    let s = newMemory(2, () => 0.99);
    const a = s.cards[0]!;
    const mate = s.cards.find((c) => c.id !== a.id && c.pair === a.pair)!;
    const known = new Map<number, number>([[mate.id, mate.pair]]);
    s = { ...s, cards: s.cards.map((c) => (c.id === a.id ? { ...c, open: true } : c)), pending: [a.id] };
    expect(chooseMemoryCard(s, known)).toBe(mate.id);
    const k2 = new Map<number, number>();
    observeCard(k2, 1, 0, () => 0.1);
    observeCard(k2, 2, 0, () => 0.9);
    expect([...k2.keys()]).toEqual([1]);
  });
});
