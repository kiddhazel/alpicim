import { canMove, emptyCells, move, type Board, type Dir } from './g2048';
import type { MemoryState } from './memory';
import type { Point, SnakeDir, SnakeState } from './snake';

const DIRS: Dir[] = ['left', 'up', 'right', 'down'];

function heuristic(b: Board): number {
  let max = 0;
  let rough = 0;
  const lg = (v: number) => (v === 0 ? 0 : Math.log2(v));
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = (b[r] as number[])[c] as number;
      max = Math.max(max, v);
      if (c < 3) rough += Math.abs(lg(v) - lg((b[r] as number[])[c + 1] as number));
      if (r < 3) rough += Math.abs(lg(v) - lg((b[r + 1] as number[])[c] as number));
    }
  }
  const corner = [b[0]?.[0], b[0]?.[3], b[3]?.[0], b[3]?.[3]].some((v) => v === max);
  return emptyCells(b).length * 12 + (corner ? lg(max) * 8 : 0) - rough * 1.5;
}

/** Hafif beklenti: hamle sonrası boş hücrelere 2 koyup en iyi ikinci hamlenin ortalamasını alır. */
export function choose2048(board: Board): Dir | null {
  let best: Dir | null = null;
  let bestScore = -Infinity;
  for (const d of DIRS) {
    const r = move(board, d);
    if (!r.moved) continue;
    const cells = emptyCells(r.board).slice(0, 6);
    let sum = 0;
    for (const [y, x] of cells) {
      const nb = r.board.map((row) => [...row]);
      (nb[y] as number[])[x] = 2;
      let top = canMove(nb) ? -Infinity : -500;
      for (const d2 of DIRS) {
        const m = move(nb, d2);
        if (m.moved) top = Math.max(top, heuristic(m.board) + m.gained * 0.1);
      }
      sum += top;
    }
    const score = (cells.length ? sum / cells.length : heuristic(r.board)) + r.gained * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

const D: Record<SnakeDir, Point> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPP: Record<SnakeDir, SnakeDir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const SD = Object.keys(D) as SnakeDir[];

/** Yemeğe BFS ile yol bulur (gövdeden kaçınarak); yol yoksa en geniş boşluğa döner. */
export function chooseSnakeDir(s: SnakeState): SnakeDir {
  const key = (x: number, y: number) => y * s.cols + x;
  const blocked = new Set(s.body.slice(0, -1).map((p) => key(p.x, p.y)));
  const head = s.body[0] as Point;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < s.cols && y < s.rows;
  const first = new Map<number, SnakeDir>();
  const queue: Point[] = [];
  const seen = new Set<number>([key(head.x, head.y)]);
  for (const d of SD) {
    if (d === OPP[s.dir]) continue;
    const x = head.x + D[d].x;
    const y = head.y + D[d].y;
    if (!inside(x, y) || blocked.has(key(x, y))) continue;
    seen.add(key(x, y));
    first.set(key(x, y), d);
    queue.push({ x, y });
  }
  const startArea = new Map<SnakeDir, number>();
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i] as Point;
    const f = first.get(key(p.x, p.y)) as SnakeDir;
    if (p.x === s.food.x && p.y === s.food.y) return f;
    startArea.set(f, (startArea.get(f) ?? 0) + 1);
    for (const d of SD) {
      const x = p.x + D[d].x;
      const y = p.y + D[d].y;
      if (!inside(x, y) || blocked.has(key(x, y)) || seen.has(key(x, y))) continue;
      seen.add(key(x, y));
      first.set(key(x, y), f);
      queue.push({ x, y });
    }
  }
  let best: SnakeDir = s.dir;
  let area = -1;
  for (const [d, n] of startArea) {
    if (n > area) {
      area = n;
      best = d;
    }
  }
  return best;
}

/**
 * Kusurlu hafızalı hafıza oyunu hamlesi. `known`: kart kimliği -> çift (gördüklerinden hatırladıkları).
 * Dönen değer çevrilecek kart kimliği (yoksa null).
 */
export function chooseMemoryCard(s: MemoryState, known: ReadonlyMap<number, number>, rand: () => number = Math.random): number | null {
  if (s.pending.length >= 2) return null;
  const closed = s.cards.filter((c) => !c.open && !c.matched);
  if (closed.length === 0) return null;
  const knownClosed = closed.filter((c) => known.has(c.id));
  if (s.pending.length === 1) {
    const open = s.cards[s.pending[0] as number];
    const mate = knownClosed.find((c) => c.pair === open?.pair);
    if (mate) return mate.id;
  } else {
    for (const c of knownClosed) {
      const mate = knownClosed.find((o) => o.id !== c.id && known.get(o.id) === known.get(c.id));
      if (mate) return c.id;
    }
  }
  const unknown = closed.filter((c) => !known.has(c.id));
  const pool = unknown.length > 0 ? unknown : closed;
  return (pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))] as { id: number }).id;
}

/** Çevrilen kartı yalnızca %70 olasılıkla hatırlar. */
export function observeCard(known: Map<number, number>, id: number, pair: number, rand: () => number = Math.random): void {
  if (rand() < 0.7) known.set(id, pair);
}
