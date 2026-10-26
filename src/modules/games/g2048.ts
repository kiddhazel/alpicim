export type Board = number[][];
export type Dir = 'left' | 'right' | 'up' | 'down';
export const SIZE = 4;

export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
}

/** Tek satırı sola kaydırır ve birleştirir (her kutu tek hamlede en çok bir kez birleşir). */
export function slideRow(row: readonly number[]): { row: number[]; gained: number } {
  const tiles = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    const a = tiles[i] as number;
    const b = tiles[i + 1];
    if (b === a) {
      out.push(a * 2);
      gained += a * 2;
      i++;
    } else {
      out.push(a);
    }
  }
  while (out.length < row.length) out.push(0);
  return { row: out, gained };
}

function rotate(b: Board): Board {
  return b.map((_, r) => b.map((__, c) => (b[SIZE - 1 - c] as number[])[r] as number));
}

/** Tahtayı yönde kaydırır. Değişmediyse moved=false. */
export function move(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  const turns = { left: 0, down: 1, right: 2, up: 3 }[dir];
  let b = board.map((r) => [...r]);
  for (let i = 0; i < turns; i++) b = rotate(b);
  let gained = 0;
  b = b.map((r) => {
    const s = slideRow(r);
    gained += s.gained;
    return s.row;
  });
  for (let i = 0; i < (4 - turns) % 4; i++) b = rotate(b);
  const moved = b.some((r, ri) => r.some((v, ci) => v !== (board[ri] as number[])[ci]));
  return { board: b, gained, moved };
}

export function emptyCells(board: Board): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  board.forEach((r, ri) => r.forEach((v, ci) => v === 0 && out.push([ri, ci])));
  return out;
}

/** Boş bir hücreye 2 (%90) ya da 4 koyar. `rand` test için enjekte edilir. */
export function addTile(board: Board, rand: () => number = Math.random): Board {
  const cells = emptyCells(board);
  if (cells.length === 0) return board;
  const [r, c] = cells[Math.min(cells.length - 1, Math.floor(rand() * cells.length))] as [number, number];
  const next = board.map((row) => [...row]);
  (next[r] as number[])[c] = rand() < 0.9 ? 2 : 4;
  return next;
}

export function newGame(rand: () => number = Math.random): Board {
  return addTile(addTile(emptyBoard(), rand), rand);
}

export function canMove(board: Board): boolean {
  if (emptyCells(board).length > 0) return true;
  return (['left', 'up'] as Dir[]).some((d) => move(board, d).moved) || (['right', 'down'] as Dir[]).some((d) => move(board, d).moved);
}

export function hasWon(board: Board): boolean {
  return board.some((r) => r.some((v) => v >= 2048));
}
