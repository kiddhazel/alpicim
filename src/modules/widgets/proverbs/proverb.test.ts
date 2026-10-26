import { describe, expect, it } from 'vitest';
import { dailyIndex, dailyProverb, EMPTY_QUIZ, makeQuestion, recordAnswer, sanitizeQuiz } from './proverb';
import { PROVERBS } from './proverbs';

describe('proverb data', () => {
  it('has about 150 entries with unique texts and meanings', () => {
    expect(PROVERBS.length).toBeGreaterThanOrEqual(140);
    expect(new Set(PROVERBS.map((p) => p.text)).size).toBe(PROVERBS.length);
    expect(new Set(PROVERBS.map((p) => p.meaning)).size).toBe(PROVERBS.length);
  });

  it('uses only known kinds and non-empty fields', () => {
    for (const p of PROVERBS) {
      expect(['atasözü', 'deyim']).toContain(p.kind);
      expect(p.text.trim()).not.toBe('');
      expect(p.meaning.trim()).not.toBe('');
    }
    expect(PROVERBS.some((p) => p.kind === 'atasözü')).toBe(true);
    expect(PROVERBS.some((p) => p.kind === 'deyim')).toBe(true);
  });
});

describe('daily pick', () => {
  it('is stable within a day and stays in range', () => {
    expect(dailyIndex('2026-10-25', 150)).toBe(dailyIndex('2026-10-25', 150));
    for (let d = 1; d <= 31; d++) {
      const key = `2026-10-${String(d).padStart(2, '0')}`;
      const i = dailyIndex(key, PROVERBS.length);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(PROVERBS.length);
    }
    expect(dailyIndex('2026-10-25', 0)).toBe(0);
  });

  it('varies across days', () => {
    const picks = new Set<number>();
    for (let d = 1; d <= 30; d++) picks.add(dailyIndex(`2026-10-${String(d).padStart(2, '0')}`, PROVERBS.length));
    expect(picks.size).toBeGreaterThan(20);
  });

  it('returns null for an empty set', () => {
    expect(dailyProverb([], '2026-10-25')).toBeNull();
    expect(dailyProverb(PROVERBS, '2026-10-25')).not.toBeNull();
  });
});

describe('quiz', () => {
  it('builds four distinct choices containing the right meaning', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 50; i++) {
      const q = makeQuestion(PROVERBS, rnd);
      expect(q).not.toBeNull();
      if (!q) continue;
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices[q.answer]).toBe(q.entry.meaning);
      for (const c of q.choices) expect(PROVERBS.some((p) => p.meaning === c)).toBe(true);
    }
  });

  it('refuses to build a question from too few entries', () => {
    expect(makeQuestion(PROVERBS.slice(0, 3))).toBeNull();
  });

  it('records answers and sanitizes saved scores', () => {
    const s1 = recordAnswer(EMPTY_QUIZ, true);
    const s2 = recordAnswer(s1, false);
    expect(s2).toEqual({ answered: 2, correct: 1 });
    expect(sanitizeQuiz(s2)).toEqual({ answered: 2, correct: 1 });
    expect(sanitizeQuiz({ answered: 2, correct: 9 })).toEqual({ answered: 2, correct: 2 });
    expect(sanitizeQuiz({ answered: -1, correct: 'x' })).toEqual({ answered: 0, correct: 0 });
    expect(sanitizeQuiz({ answered: 1.5, correct: 1 })).toEqual({ answered: 0, correct: 0 });
    expect(sanitizeQuiz(null)).toEqual(EMPTY_QUIZ);
  });
});
