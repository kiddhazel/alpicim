export interface Point {
  x: number;
  y: number;
}
export type SnakeDir = 'up' | 'down' | 'left' | 'right';
export interface SnakeState {
  cols: number;
  rows: number;
  body: Point[]; // [0] = baş
  dir: SnakeDir;
  food: Point;
  score: number;
  over: boolean;
}

const DELTA: Record<SnakeDir, Point> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<SnakeDir, SnakeDir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function placeFood(cols: number, rows: number, body: readonly Point[], rand: () => number = Math.random): Point {
  const free: Point[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!body.some((p) => p.x === x && p.y === y)) free.push({ x, y });
  return free[Math.min(free.length - 1, Math.floor(rand() * free.length))] ?? { x: 0, y: 0 };
}

export function initSnake(cols = 20, rows = 16, rand: () => number = Math.random): SnakeState {
  const cy = Math.floor(rows / 2);
  const cx = Math.floor(cols / 2);
  const body = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
  return { cols, rows, body, dir: 'right', food: placeFood(cols, rows, body, rand), score: 0, over: false };
}

/** Tersine dönüşe izin verilmez. */
export function turn(dir: SnakeDir, requested: SnakeDir): SnakeDir {
  return OPPOSITE[dir] === requested ? dir : requested;
}

export function step(s: SnakeState, requested: SnakeDir, rand: () => number = Math.random): SnakeState {
  if (s.over) return s;
  const dir = turn(s.dir, requested);
  const d = DELTA[dir];
  const head = s.body[0] as Point;
  const next = { x: head.x + d.x, y: head.y + d.y };
  const ate = next.x === s.food.x && next.y === s.food.y;
  // Yemek yenmediyse kuyruk çekilir; o hücreye girmek çarpma sayılmaz.
  const solid = ate ? s.body : s.body.slice(0, -1);
  const hit = next.x < 0 || next.y < 0 || next.x >= s.cols || next.y >= s.rows || solid.some((p) => p.x === next.x && p.y === next.y);
  if (hit) return { ...s, dir, over: true };
  const body = [next, ...solid];
  return {
    ...s,
    dir,
    body,
    score: s.score + (ate ? 1 : 0),
    food: ate ? placeFood(s.cols, s.rows, body, rand) : s.food,
  };
}

/** Yemek başına hızlanır; en düşük 55 ms. */
export function tickMs(score: number): number {
  return Math.max(55, 160 - score * 5);
}
