import { ANSWERS, VALID_EXTRA } from './words';

export const WORD_LEN = 5;
export const MAX_TRIES = 6;
export type LetterState = 'correct' | 'present' | 'absent';

/** Türkçe büyük harf (i → İ, ı → I). */
export function trUpper(s: string): string {
  return s.toLocaleUpperCase('tr-TR');
}

export const TR_LETTERS = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

export function isTrLetter(ch: string): boolean {
  return ch.length === 1 && TR_LETTERS.includes(ch);
}

/** Türkçe Q klavye satırları. */
export const KEY_ROWS: readonly string[] = ['ERTYUIOPĞÜ', 'ASDFGHJKLŞİ', 'ZCVBNMÖÇ'];

/** Fiziksel tuş → harf (büyük, Türkçe); harf değilse null. */
export function keyToLetter(key: string): string | null {
  if (key.length !== 1) return null;
  const up = trUpper(key);
  return isTrLetter(up) ? up : null;
}

const answerSet = new Set(ANSWERS.map(trUpper));
const validSet = new Set([...ANSWERS, ...VALID_EXTRA].map(trUpper));

export function isValidGuess(word: string): boolean {
  return validSet.has(trUpper(word));
}

/** Yerel takvim günü: yyyy-mm-dd. */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Günün sözcüğü: herkes için aynı (tarihe göre deterministik, sözcükler karışık sırada gezilir). */
export function dailyWord(key: string = dayKey()): string {
  const n = ANSWERS.length;
  const day = dayNumber(key);
  // n ile aralarında asal bir adım: tüm sözcükler tekrarsız gezilir.
  let step = 97;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  while (gcd(step, n) !== 1) step += 2;
  const idx = (((day * step) % n) + n) % n;
  return trUpper(ANSWERS[idx] as string);
}

/** Tahmini değerlendirir (tekrarlı harfler doğru sayılır). */
export function evaluate(guess: string, answer: string): LetterState[] {
  const g = [...trUpper(guess)];
  const a = [...trUpper(answer)];
  const res: LetterState[] = g.map(() => 'absent');
  const left = new Map<string, number>();
  g.forEach((ch, i) => {
    if (ch === a[i]) res[i] = 'correct';
    else left.set(a[i] as string, (left.get(a[i] as string) ?? 0) + 1);
  });
  g.forEach((ch, i) => {
    if (res[i] === 'correct') return;
    const n = left.get(ch) ?? 0;
    if (n > 0) {
      res[i] = 'present';
      left.set(ch, n - 1);
    }
  });
  return res;
}

/** Klavye renkleri: her harf için gördüğü en iyi durum. */
export function keyStates(guesses: readonly string[], answer: string): Map<string, LetterState> {
  const rank: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };
  const out = new Map<string, LetterState>();
  for (const g of guesses) {
    const ev = evaluate(g, answer);
    [...trUpper(g)].forEach((ch, i) => {
      const s = ev[i] as LetterState;
      const cur = out.get(ch);
      if (!cur || rank[s] > rank[cur]) out.set(ch, s);
    });
  }
  return out;
}

export type WordleStatus = 'playing' | 'won' | 'lost';
export interface WordleDay {
  day: string;
  guesses: string[];
  status: WordleStatus;
}

export function statusOf(guesses: readonly string[], answer: string): WordleStatus {
  if (guesses.length > 0 && trUpper(guesses[guesses.length - 1] as string) === trUpper(answer)) return 'won';
  return guesses.length >= MAX_TRIES ? 'lost' : 'playing';
}

export function sanitizeDay(raw: unknown, today: string): WordleDay {
  const fresh: WordleDay = { day: today, guesses: [], status: 'playing' };
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Record<string, unknown>;
  if (r.day !== today || !Array.isArray(r.guesses)) return fresh;
  const guesses = r.guesses
    .filter((g): g is string => typeof g === 'string' && [...g].length === WORD_LEN)
    .map(trUpper)
    .slice(0, MAX_TRIES);
  return { day: today, guesses, status: statusOf(guesses, dailyWord(today)) };
}

export interface WordleStats {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  lastDay: string;
  dist: number[];
}

export const EMPTY_STATS: WordleStats = { played: 0, wins: 0, streak: 0, maxStreak: 0, lastDay: '', dist: [0, 0, 0, 0, 0, 0] };

export function sanitizeStats(raw: unknown): WordleStats {
  if (!raw || typeof raw !== 'object') return EMPTY_STATS;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const dist = Array.isArray(r.dist) ? Array.from({ length: MAX_TRIES }, (_, i) => num(r.dist && (r.dist as unknown[])[i])) : EMPTY_STATS.dist;
  return {
    played: num(r.played),
    wins: num(r.wins),
    streak: num(r.streak),
    maxStreak: num(r.maxStreak),
    lastDay: typeof r.lastDay === 'string' ? r.lastDay : '',
    dist,
  };
}

function prevDay(key: string): string {
  const d = new Date(dayNumber(key) * 86_400_000);
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Bir günün bitişini istatistiğe işler (aynı gün iki kez sayılmaz). */
export function recordResult(stats: WordleStats, day: string, won: boolean, tries: number): WordleStats {
  if (stats.lastDay === day) return stats;
  const streak = won ? (stats.lastDay === prevDay(day) ? stats.streak + 1 : 1) : 0;
  const dist = [...stats.dist];
  if (won && tries >= 1 && tries <= MAX_TRIES) dist[tries - 1] = (dist[tries - 1] ?? 0) + 1;
  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    lastDay: day,
    dist,
  };
}

const EMOJI: Record<LetterState, string> = { correct: '🟩', present: '🟨', absent: '⬛' };

/** Paylaşılacak emoji ızgarası. */
export function shareText(guesses: readonly string[], answer: string, day: string): string {
  const won = statusOf(guesses, answer) === 'won';
  const head = `Alpicim Kelime ${day} ${won ? guesses.length : 'X'}/${MAX_TRIES}`;
  const rows = guesses.map((g) =>
    evaluate(g, answer)
      .map((s) => EMOJI[s])
      .join(''),
  );
  return [head, ...rows].join('\n');
}

export { answerSet };
