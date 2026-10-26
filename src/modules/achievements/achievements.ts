import type { TrackCounter, TrackDetail } from '../../shared/lib/track';

/** Başarım mantığı (saf): sayaçlar, rozet tanımları, açılma kuralları. */

export const ACHIEVEMENTS_KEY = 'achievements';

export type BadgeId =
  | 'first2048'
  | 'snake50'
  | 'snake150'
  | 'memory5'
  | 'wordle'
  | 'miniWin5'
  | 'player10'
  | 'streak7'
  | 'pet50'
  | 'pet200'
  | 'fed10'
  | 'pomodoro10'
  | 'pomodoro50'
  | 'todo25'
  | 'todo100'
  | 'news100'
  | 'mood7'
  | 'briefing5'
  | 'eyes10'
  | 'screensaver';

export interface BadgeDef {
  id: BadgeId;
  counter: TrackCounter;
  target: number;
}

/** Sayaç yerine en yüksek değeri tutan sayaçlar. */
const MAX_COUNTERS: ReadonlySet<TrackCounter> = new Set<TrackCounter>(['games.snake.score', 'laila.streakDay']);

export const BADGES: readonly BadgeDef[] = [
  { id: 'first2048', counter: 'games.2048.win', target: 1 },
  { id: 'snake50', counter: 'games.snake.score', target: 50 },
  { id: 'snake150', counter: 'games.snake.score', target: 150 },
  { id: 'memory5', counter: 'games.memory.win', target: 5 },
  { id: 'wordle', counter: 'games.wordle.win', target: 1 },
  { id: 'miniWin5', counter: 'games.mini.win', target: 5 },
  { id: 'player10', counter: 'games.played', target: 10 },
  { id: 'streak7', counter: 'laila.streakDay', target: 7 },
  { id: 'pet50', counter: 'laila.pet', target: 50 },
  { id: 'pet200', counter: 'laila.pet', target: 200 },
  { id: 'fed10', counter: 'laila.fed', target: 10 },
  { id: 'pomodoro10', counter: 'pomodoro.done', target: 10 },
  { id: 'pomodoro50', counter: 'pomodoro.done', target: 50 },
  { id: 'todo25', counter: 'todo.done', target: 25 },
  { id: 'todo100', counter: 'todo.done', target: 100 },
  { id: 'news100', counter: 'news.read', target: 100 },
  { id: 'mood7', counter: 'mood.logged', target: 7 },
  { id: 'briefing5', counter: 'briefing.seen', target: 5 },
  { id: 'eyes10', counter: 'reminder.followed', target: 10 },
  { id: 'screensaver', counter: 'screensaver.seen', target: 1 },
];

export interface AchievementState {
  counters: Partial<Record<TrackCounter, number>>;
  /** Rozet → açılma zamanı (ms). */
  unlocked: Partial<Record<BadgeId, number>>;
}

export const EMPTY_ACHIEVEMENTS: AchievementState = { counters: {}, unlocked: {} };

const BADGE_IDS = new Set<string>(BADGES.map((b) => b.id));
const COUNTER_IDS = new Set<string>(BADGES.map((b) => b.counter));

export function sanitizeAchievements(raw: unknown): AchievementState {
  if (typeof raw !== 'object' || raw === null) return { counters: {}, unlocked: {} };
  const r = raw as Record<string, unknown>;
  const counters: AchievementState['counters'] = {};
  const unlocked: AchievementState['unlocked'] = {};
  if (typeof r.counters === 'object' && r.counters !== null) {
    for (const [k, v] of Object.entries(r.counters)) {
      if (COUNTER_IDS.has(k) && typeof v === 'number' && Number.isFinite(v)) {
        counters[k as TrackCounter] = Math.min(1_000_000, Math.max(0, Math.floor(v)));
      }
    }
  }
  if (typeof r.unlocked === 'object' && r.unlocked !== null) {
    for (const [k, v] of Object.entries(r.unlocked)) {
      if (BADGE_IDS.has(k) && typeof v === 'number' && Number.isFinite(v)) unlocked[k as BadgeId] = v;
    }
  }
  return { counters, unlocked };
}

export function counterValue(state: AchievementState, counter: TrackCounter): number {
  return state.counters[counter] ?? 0;
}

export interface TrackResult {
  state: AchievementState;
  newlyUnlocked: BadgeId[];
}

/** Bir izleme olayını uygular; yeni açılan rozetleri döndürür. Girdi değiştirilmez. */
export function applyTrack(state: AchievementState, detail: TrackDetail, now: number): TrackResult {
  const prev = counterValue(state, detail.counter);
  let next: number;
  if (typeof detail.max === 'number' && Number.isFinite(detail.max)) {
    next = Math.max(prev, Math.floor(detail.max));
  } else if (MAX_COUNTERS.has(detail.counter)) {
    next = Math.max(prev, Math.floor(detail.by ?? 1));
  } else {
    const by = typeof detail.by === 'number' && Number.isFinite(detail.by) ? Math.floor(detail.by) : 1;
    next = prev + Math.max(0, by);
  }
  next = Math.min(1_000_000, next);
  const counters = { ...state.counters, [detail.counter]: next };
  const unlocked = { ...state.unlocked };
  const newlyUnlocked: BadgeId[] = [];
  for (const b of BADGES) {
    if (b.counter === detail.counter && unlocked[b.id] === undefined && next >= b.target) {
      unlocked[b.id] = now;
      newlyUnlocked.push(b.id);
    }
  }
  return { state: { counters, unlocked }, newlyUnlocked };
}

/** 0–1 ilerleme (rozet galerisi). */
export function badgeProgress(state: AchievementState, badge: BadgeDef): number {
  if (state.unlocked[badge.id] !== undefined) return 1;
  return Math.min(1, counterValue(state, badge.counter) / badge.target);
}
