export interface Card {
  id: number;
  pair: number;
  open: boolean;
  matched: boolean;
}
export interface MemoryState {
  cards: Card[];
  moves: number;
  /** Açık ve henüz eşleşmemiş kartların kimlikleri (en çok 2). */
  pending: number[];
}

export const PAIRS = 8;

export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export function newMemory(pairs = PAIRS, rand: () => number = Math.random): MemoryState {
  const pairIds = shuffle(Array.from({ length: pairs * 2 }, (_, i) => Math.floor(i / 2)), rand);
  return { cards: pairIds.map((pair, id) => ({ id, pair, open: false, matched: false })), moves: 0, pending: [] };
}

/** Kart çevirir. İki kart açıkken ya da kart zaten açık/eşleşmişken yok sayılır. */
export function flip(s: MemoryState, id: number): MemoryState {
  const card = s.cards[id];
  if (!card || card.open || card.matched || s.pending.length >= 2) return s;
  const cards = s.cards.map((c) => (c.id === id ? { ...c, open: true } : c));
  const pending = [...s.pending, id];
  if (pending.length < 2) return { ...s, cards, pending };
  const [a, b] = pending.map((i) => cards[i] as Card) as [Card, Card];
  if (a.pair === b.pair) {
    return {
      cards: cards.map((c) => (c.id === a.id || c.id === b.id ? { ...c, matched: true } : c)),
      moves: s.moves + 1,
      pending: [],
    };
  }
  return { cards, moves: s.moves + 1, pending };
}

/** Eşleşmeyen iki açık kartı kapatır. */
export function resolveMismatch(s: MemoryState): MemoryState {
  if (s.pending.length < 2) return s;
  return { ...s, cards: s.cards.map((c) => (s.pending.includes(c.id) ? { ...c, open: false } : c)), pending: [] };
}

export function isDone(s: MemoryState): boolean {
  return s.cards.every((c) => c.matched);
}
