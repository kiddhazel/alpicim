import { describe, expect, it } from 'vitest';
import { applyTrack, badgeProgress, BADGES, EMPTY_ACHIEVEMENTS, sanitizeAchievements } from './achievements';

describe('achievements', () => {
  it('sayaç artırır ve eşikte rozet açar', () => {
    let s = EMPTY_ACHIEVEMENTS;
    for (let i = 0; i < 9; i++) s = applyTrack(s, { counter: 'pomodoro.done', by: 1 }, 1).state;
    expect(s.unlocked.pomodoro10).toBeUndefined();
    const r = applyTrack(s, { counter: 'pomodoro.done', by: 1 }, 5);
    expect(r.newlyUnlocked).toEqual(['pomodoro10']);
    expect(r.state.unlocked.pomodoro10).toBe(5);
    expect(applyTrack(r.state, { counter: 'pomodoro.done', by: 1 }, 6).newlyUnlocked).toEqual([]);
  });

  it('en yüksek değer sayaçları geriye gitmez', () => {
    let r = applyTrack(EMPTY_ACHIEVEMENTS, { counter: 'games.snake.score', max: 60 }, 1);
    expect(r.newlyUnlocked).toEqual(['snake50']);
    r = applyTrack(r.state, { counter: 'games.snake.score', max: 10 }, 2);
    expect(r.state.counters['games.snake.score']).toBe(60);
  });

  it('seri sayacı en yükseği tutar', () => {
    let r = applyTrack(EMPTY_ACHIEVEMENTS, { counter: 'laila.streakDay', by: 7 }, 1);
    expect(r.newlyUnlocked).toEqual(['streak7']);
    r = applyTrack(r.state, { counter: 'laila.streakDay', by: 2 }, 2);
    expect(r.state.counters['laila.streakDay']).toBe(7);
  });

  it('aynı sayaçtaki birden çok rozet birlikte açılabilir', () => {
    const r = applyTrack(EMPTY_ACHIEVEMENTS, { counter: 'laila.pet', by: 200 }, 1);
    expect([...r.newlyUnlocked].sort()).toEqual(['pet200', 'pet50']);
  });

  it('girdiyi değiştirmez, bozuk veriyi temizler', () => {
    applyTrack(EMPTY_ACHIEVEMENTS, { counter: 'todo.done' }, 1);
    expect(EMPTY_ACHIEVEMENTS.counters).toEqual({});
    const s = sanitizeAchievements({ counters: { 'todo.done': 3.7, bogus: 4, 'news.read': 'x' }, unlocked: { todo25: 5, nope: 1 } });
    expect(s).toEqual({ counters: { 'todo.done': 3 }, unlocked: { todo25: 5 } });
    expect(sanitizeAchievements(null)).toEqual({ counters: {}, unlocked: {} });
  });

  it('ilerleme 0–1 arasındadır', () => {
    const b = BADGES.find((x) => x.id === 'todo25');
    if (!b) throw new Error('rozet yok');
    const s = applyTrack(EMPTY_ACHIEVEMENTS, { counter: 'todo.done', by: 5 }, 1).state;
    expect(badgeProgress(s, b)).toBeCloseTo(0.2);
  });
});
