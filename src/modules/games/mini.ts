import { trUpper } from './wordle';
import { ANSWERS } from './words';

// ---------- Taş-Kâğıt-Makas ----------
export type Rps = 'rock' | 'paper' | 'scissors';
export const RPS_ALL: readonly Rps[] = ['rock', 'paper', 'scissors'];
const BEATS: Record<Rps, Rps> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
export type Outcome = 'win' | 'lose' | 'draw'; // oyuncunun bakışından

export function rpsOutcome(user: Rps, laila: Rps): Outcome {
  if (user === laila) return 'draw';
  return BEATS[user] === laila ? 'win' : 'lose';
}

/** Kullanıcıyı yenen hamle. */
export function counterOf(m: Rps): Rps {
  return RPS_ALL.find((x) => BEATS[x] === m) as Rps;
}

/** Laila'nın hamlesi: çoğunlukla rastgele, nadiren (≈%7) göz kırparak "hile" yapar. */
export function lailaRps(user: Rps, rand: () => number = Math.random): { move: Rps; cheated: boolean } {
  if (rand() < 0.07) return { move: counterOf(user), cheated: true };
  return { move: RPS_ALL[Math.min(2, Math.floor(rand() * 3))] as Rps, cheated: false };
}

// ---------- XOX ----------
export type Mark = 'X' | 'O' | null;
export type TttBoard = Mark[];
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function emptyTtt(): TttBoard {
  return Array<Mark>(9).fill(null);
}

export function tttWinner(b: readonly Mark[]): 'X' | 'O' | 'draw' | null {
  for (const [a, c, d] of LINES as number[][]) {
    const m = b[a as number];
    if (m && m === b[c as number] && m === b[d as number]) return m;
  }
  return b.every(Boolean) ? 'draw' : null;
}

function minimax(b: Mark[], turn: 'X' | 'O', me: 'X' | 'O'): number {
  const w = tttWinner(b);
  if (w === me) return 1;
  if (w === 'draw') return 0;
  if (w) return -1;
  const scores: number[] = [];
  b.forEach((v, i) => {
    if (v) return;
    const nb = [...b];
    nb[i] = turn;
    scores.push(minimax(nb, turn === 'X' ? 'O' : 'X', me));
  });
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

/** Kusursuz hamle (minimax). */
export function bestTttMove(b: readonly Mark[], me: 'X' | 'O'): number {
  let best = -1;
  let bestScore = -Infinity;
  b.forEach((v, i) => {
    if (v) return;
    const nb = [...b];
    nb[i] = me;
    const s = minimax(nb, me === 'X' ? 'O' : 'X', me);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

/** Laila (O): %25 rastgele, aksi halde minimax. Boş hücre yoksa -1. */
export function lailaTtt(b: readonly Mark[], rand: () => number = Math.random): number {
  const free = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (free.length === 0) return -1;
  if (rand() < 0.25) return free[Math.min(free.length - 1, Math.floor(rand() * free.length))] as number;
  return bestTttMove(b, 'O');
}

// ---------- Adam asmaca ----------
export const HANGMAN_MAX_MISS = 6;
export interface Hangman {
  word: string; // büyük harf
  guessed: string[];
}

export function newHangman(rand: () => number = Math.random): Hangman {
  const w = ANSWERS[Math.min(ANSWERS.length - 1, Math.floor(rand() * ANSWERS.length))] as string;
  return { word: trUpper(w), guessed: [] };
}

export function hangmanGuess(h: Hangman, letter: string): Hangman {
  const l = trUpper(letter);
  return h.guessed.includes(l) ? h : { ...h, guessed: [...h.guessed, l] };
}

export function misses(h: Hangman): number {
  return h.guessed.filter((l) => !h.word.includes(l)).length;
}

export function masked(h: Hangman): string[] {
  return [...h.word].map((c) => (h.guessed.includes(c) ? c : '_'));
}

export function hangmanStatus(h: Hangman): 'playing' | 'won' | 'lost' {
  if (misses(h) >= HANGMAN_MAX_MISS) return 'lost';
  return [...h.word].every((c) => h.guessed.includes(c)) ? 'won' : 'playing';
}
