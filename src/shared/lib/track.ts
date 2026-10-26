/**
 * Başarım sayaçları için gevşek bağlı olay: modüller birbirini içe aktarmadan sayaç artırır,
 * `modules/achievements` dinler ve rozet açar.
 */

export const TRACK_EVENT = 'alpicim:track';

export type TrackCounter =
  | 'laila.pet'
  | 'laila.fed'
  | 'laila.streakDay'
  | 'games.played'
  | 'games.2048.win'
  | 'games.snake.score'
  | 'games.memory.win'
  | 'games.wordle.win'
  | 'games.mini.win'
  | 'news.read'
  | 'pomodoro.done'
  | 'todo.done'
  | 'mood.logged'
  | 'briefing.seen'
  | 'screensaver.seen'
  | 'reminder.followed';

export interface TrackDetail {
  counter: TrackCounter;
  /** Artış (varsayılan 1). */
  by?: number;
  /** Sayaç yerine en yüksek değeri tut (ör. yılan skoru). */
  max?: number;
}

export function track(counter: TrackCounter, by = 1): void {
  window.dispatchEvent(new CustomEvent<TrackDetail>(TRACK_EVENT, { detail: { counter, by } }));
}

export function trackMax(counter: TrackCounter, value: number): void {
  window.dispatchEvent(new CustomEvent<TrackDetail>(TRACK_EVENT, { detail: { counter, max: value } }));
}
