import { describe, expect, it } from 'vitest';
import {
  bestTttMove, emptyTtt, hangmanGuess, hangmanStatus, lailaRps, lailaTtt, masked, misses, newHangman, rpsOutcome, tttWinner,
  type Mark,
} from './mini';
import { ANSWERS, VALID_EXTRA } from './words';
import {
  dailyWord, evaluate, isValidGuess, keyStates, keyToLetter, MAX_TRIES, recordResult, EMPTY_STATS, sanitizeDay, shareText, trUpper,
} from './wordle';

describe('kelime listeleri', () => {
  it('tüm sözcükler 5 harfli ve tekrarsız', () => {
    const all = [...ANSWERS, ...VALID_EXTRA].map(trUpper);
    expect(all.every((w) => [...w].length === 5)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
    expect(ANSWERS.length).toBeGreaterThanOrEqual(300);
  });
});

describe('kelime (wordle)', () => {
  it('Türkçe büyük harf', () => {
    expect(trUpper('ışık')).toBe('IŞIK');
    expect(trUpper('iğne')).toBe('İĞNE');
    expect(keyToLetter('i')).toBe('İ');
    expect(keyToLetter('ı')).toBe('I');
    expect(keyToLetter('1')).toBeNull();
  });
  it('değerlendirme: tekrarlı harfler', () => {
    expect(evaluate('ALLAH', 'LAMBA')).toEqual(['present', 'present', 'absent', 'present', 'absent']);
    expect(evaluate('kalem', 'kalem')).toEqual(Array(5).fill('correct'));
    expect(keyStates(['KARAR'], 'KALEM').get('K')).toBe('correct');
  });
  it('günün sözcüğü deterministik ve geçerli', () => {
    expect(dailyWord('2026-10-26')).toBe(dailyWord('2026-10-26'));
    expect(dailyWord('2026-10-26')).not.toBe(dailyWord('2026-10-27'));
    expect(isValidGuess(dailyWord('2026-10-26'))).toBe(true);
    expect(isValidGuess('QQQQQ')).toBe(false);
  });
  it('gün değişince oyun sıfırlanır; istatistik ve paylaşım', () => {
    const w = dailyWord('2026-10-26');
    const saved = sanitizeDay({ day: '2026-10-26', guesses: ['ARABA', w] }, '2026-10-26');
    expect(saved.status).toBe('won');
    expect(sanitizeDay(saved, '2026-10-27').guesses).toEqual([]);
    const s1 = recordResult(EMPTY_STATS, '2026-10-26', true, 2);
    expect(recordResult(s1, '2026-10-26', true, 2)).toBe(s1);
    const s2 = recordResult(s1, '2026-10-27', true, 3);
    expect(s2.streak).toBe(2);
    expect(recordResult(s2, '2026-10-29', false, MAX_TRIES).streak).toBe(0);
    expect(shareText(['ARABA', w], w, '2026-10-26')).toContain('2/6');
  });
});

describe('mini oyunlar', () => {
  it('TKM sonuçları ve hile', () => {
    expect(rpsOutcome('rock', 'scissors')).toBe('win');
    expect(rpsOutcome('rock', 'paper')).toBe('lose');
    expect(rpsOutcome('paper', 'paper')).toBe('draw');
    const r = lailaRps('rock', () => 0.01);
    expect(r).toEqual({ move: 'paper', cheated: true });
    expect(lailaRps('rock', () => 0.5).cheated).toBe(false);
  });
  it('XOX kazanan ve minimax', () => {
    const b: Mark[] = ['O', 'O', null, 'X', 'X', null, null, null, null];
    expect(bestTttMove(b, 'O')).toBe(2);
    expect(bestTttMove(['X', 'X', null, null, 'O', null, null, null, null], 'O')).toBe(2);
    expect(tttWinner(['X', 'X', 'X', null, null, null, null, null, null])).toBe('X');
    expect(tttWinner(emptyTtt())).toBeNull();
    expect(lailaTtt(b, () => 0.9)).toBe(2);
  });
  it('adam asmaca', () => {
    let h = { word: 'KİTAP', guessed: [] as string[] };
    h = hangmanGuess(hangmanGuess(h, 'k'), 'z');
    expect(masked(h)).toEqual(['K', '_', '_', '_', '_']);
    expect(misses(h)).toBe(1);
    expect(hangmanStatus(h)).toBe('playing');
    for (const l of 'iİtap') h = hangmanGuess(h, l);
    expect(hangmanStatus(h)).toBe('won');
    expect(newHangman(() => 0).word).toBe(trUpper(ANSWERS[0] as string));
  });
});
