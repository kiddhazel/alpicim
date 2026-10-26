import { obj } from '../types';
import type { ProverbEntry } from './proverbs';

/** Sınav puanı (kalıcı: "proverb.quiz"). */
export interface QuizState {
  answered: number;
  correct: number;
}

export const EMPTY_QUIZ: QuizState = { answered: 0, correct: 0 };

export interface QuizQuestion {
  entry: ProverbEntry;
  /** Dört anlam seçeneği (karışık sırada). */
  choices: string[];
  /** Doğru seçeneğin dizini. */
  answer: number;
}

const MAX_COUNT = 1_000_000;

/** Yerel gün anahtarından (YYYY-MM-DD) kararlı bir dizin üretir; her gün farklı, aynı gün aynı girdi. */
export function dailyIndex(dayKey: string, count: number): number {
  if (count < 1) return 0;
  const [y, m, d] = dayKey.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
  return Math.abs(Math.imul(dayNumber, 0x9e3779b1)) % count;
}

export function dailyProverb(entries: readonly ProverbEntry[], dayKey: string): ProverbEntry | null {
  if (entries.length === 0) return null;
  return entries[dailyIndex(dayKey, entries.length)] ?? null;
}

function shuffle<T>(items: readonly T[], rnd: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rnd() * (i + 1)));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/**
 * Sınav sorusu: rastgele bir girdi ve onun anlamı + üç farklı yanlış anlam.
 * `rnd` [0, 1) üretir (testte sabit verilir). Yeterli girdi yoksa null.
 */
export function makeQuestion(entries: readonly ProverbEntry[], rnd: () => number = Math.random): QuizQuestion | null {
  if (entries.length < 4) return null;
  const entry = entries[Math.min(entries.length - 1, Math.floor(rnd() * entries.length))];
  if (!entry) return null;
  const distractors = [...new Set(entries.filter((e) => e.meaning !== entry.meaning).map((e) => e.meaning))];
  const wrong = shuffle(distractors, rnd).slice(0, 3);
  if (wrong.length < 3) return null;
  const choices = shuffle([entry.meaning, ...wrong], rnd);
  return { entry, choices, answer: choices.indexOf(entry.meaning) };
}

export function recordAnswer(state: QuizState, correct: boolean): QuizState {
  return { answered: state.answered + 1, correct: state.correct + (correct ? 1 : 0) };
}

/** Kalıcı kaydı doğrular; bozuk alanlar sıfıra çekilir, doğru sayısı cevap sayısını aşamaz. */
export function sanitizeQuiz(raw: unknown): QuizState {
  const r = obj(raw);
  const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(v, MAX_COUNT) : 0);
  const answered = int(r.answered);
  return { answered, correct: Math.min(int(r.correct), answered) };
}
