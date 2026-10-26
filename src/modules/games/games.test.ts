import { describe, expect, it } from 'vitest';
import { addTile, canMove, emptyBoard, move, slideRow } from './g2048';
import { flip, isDone, newMemory, resolveMismatch } from './memory';
import { initSnake, placeFood, step, tickMs } from './snake';

describe('2048', () => {
  it('birleştirir ve her kutu bir kez birleşir', () => {
    expect(slideRow([2, 2, 2, 2])).toEqual({ row: [4, 4, 0, 0], gained: 8 });
    expect(slideRow([2, 2, 4, 0])).toEqual({ row: [4, 4, 0, 0], gained: 4 });
    expect(slideRow([0, 4, 0, 4]).row).toEqual([8, 0, 0, 0]);
    expect(slideRow([2, 4, 2, 4]).gained).toBe(0);
  });
  it('dört yönde kayar', () => {
    const b = emptyBoard();
    (b[0] as number[])[0] = 2;
    (b[0] as number[])[3] = 2;
    expect(move(b, 'left').board[0]).toEqual([4, 0, 0, 0]);
    expect(move(b, 'right').board[0]).toEqual([0, 0, 0, 4]);
    const down = move(b, 'down').board;
    expect(down[3]).toEqual([2, 0, 0, 2]);
    expect(move(down, 'up').board[0]).toEqual([2, 0, 0, 2]);
  });
  it('değişmeyen hamle moved=false', () => {
    const b = emptyBoard();
    (b[0] as number[])[0] = 2;
    expect(move(b, 'left').moved).toBe(false);
    expect(move(b, 'right').moved).toBe(true);
  });
  it('yeni kutu boş hücreye gelir; dolu tahtada hamle yok', () => {
    expect(addTile(emptyBoard(), () => 0)[0]?.[0]).toBe(2);
    const full = [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]];
    expect(canMove(full)).toBe(false);
    expect(canMove([[2, 2, 4, 8], ...full.slice(1)])).toBe(true);
  });
});

describe('yılan', () => {
  it('ilerler, yemeyince uzamaz', () => {
    const s = initSnake(10, 10, () => 0);
    const n = step(s, 'right', () => 0);
    expect(n.body).toHaveLength(3);
    expect(n.body[0]).toEqual({ x: (s.body[0]?.x ?? 0) + 1, y: s.body[0]?.y });
  });
  it('yemek yiyince uzar ve puan artar', () => {
    const s = initSnake(10, 10, () => 0);
    const head = s.body[0] ?? { x: 0, y: 0 };
    const n = step({ ...s, food: { x: head.x + 1, y: head.y } }, 'right', () => 0);
    expect(n.body).toHaveLength(4);
    expect(n.score).toBe(1);
  });
  it('duvara çarpınca biter; tersine dönemez', () => {
    const s = initSnake(10, 10);
    expect(step({ ...s, body: [{ x: 9, y: 5 }, { x: 8, y: 5 }] }, 'right').over).toBe(true);
    expect(step(s, 'left').dir).toBe('right');
  });
  it('kendine çarpınca biter', () => {
    const s = initSnake(10, 10);
    const body = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }];
    expect(step({ ...s, body, dir: 'up' }, 'left').over).toBe(true);
  });
  it('yemek gövdeye denk gelmez; hız artar', () => {
    const body = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    expect(placeFood(3, 1, body, () => 0)).toEqual({ x: 2, y: 0 });
    expect(tickMs(10)).toBeLessThan(tickMs(0));
  });
});

describe('hafıza', () => {
  it('8 çift, 16 kart', () => {
    const s = newMemory(8, () => 0.3);
    expect(s.cards).toHaveLength(16);
    for (let p = 0; p < 8; p++) expect(s.cards.filter((c) => c.pair === p)).toHaveLength(2);
  });
  it('eşleşme ve eşleşmeme', () => {
    let s = newMemory(2, () => 0.99);
    const a = s.cards[0]!;
    const same = s.cards.find((c) => c.id !== a.id && c.pair === a.pair)!;
    const other = s.cards.find((c) => c.pair !== a.pair)!;
    s = flip(flip(s, a.id), other.id);
    expect(s.moves).toBe(1);
    expect(flip(s, same.id)).toBe(s);
    s = resolveMismatch(s);
    expect(s.cards.every((c) => !c.open)).toBe(true);
    s = flip(flip(s, a.id), same.id);
    expect(s.cards.filter((c) => c.matched)).toHaveLength(2);
    expect(isDone(s)).toBe(false);
  });
});
