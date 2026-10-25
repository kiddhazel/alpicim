/** Pomodoro zamanlayıcısının saf durum mantığı (birim testli). Bitiş zamanı saklanır; yeniden açılışta doğru kalır. */

export type Phase = 'work' | 'break';

export interface PomodoroState {
  phase: Phase;
  /** Çalışıyorsa bitiş zamanı (ms), duraklatılmışsa null. */
  endsAt: number | null;
  /** Duraklatılmışken kalan süre (ms). */
  remainingMs: number;
  /** Tamamlanan çalışma oturumu sayısı. */
  completed: number;
}

export function initialState(workMin: number): PomodoroState {
  return { phase: 'work', endsAt: null, remainingMs: workMin * 60_000, completed: 0 };
}

export function remaining(s: PomodoroState, now: number): number {
  return s.endsAt === null ? s.remainingMs : Math.max(0, s.endsAt - now);
}

export function start(s: PomodoroState, now: number): PomodoroState {
  return s.endsAt !== null ? s : { ...s, endsAt: now + s.remainingMs };
}

export function pause(s: PomodoroState, now: number): PomodoroState {
  return s.endsAt === null ? s : { ...s, endsAt: null, remainingMs: remaining(s, now) };
}

export function reset(workMin: number, s: PomodoroState): PomodoroState {
  return { ...initialState(workMin), completed: s.completed };
}

/** Süre dolduysa sonraki evreye geçer (duraklatılmış olarak). Değişiklik yoksa aynı nesne döner. */
export function advance(s: PomodoroState, now: number, workMin: number, breakMin: number): PomodoroState {
  if (s.endsAt === null || s.endsAt > now) return s;
  const nextPhase: Phase = s.phase === 'work' ? 'break' : 'work';
  return {
    phase: nextPhase,
    endsAt: null,
    remainingMs: (nextPhase === 'work' ? workMin : breakMin) * 60_000,
    completed: s.completed + (s.phase === 'work' ? 1 : 0),
  };
}

export function sanitizeState(raw: unknown, workMin: number): PomodoroState {
  if (!raw || typeof raw !== 'object') return initialState(workMin);
  const r = raw as Record<string, unknown>;
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  return {
    phase: r.phase === 'break' ? 'break' : 'work',
    endsAt: typeof r.endsAt === 'number' && Number.isFinite(r.endsAt) ? r.endsAt : null,
    remainingMs: Math.min(n(r.remainingMs, workMin * 60_000), 180 * 60_000),
    completed: Math.min(999, Math.round(n(r.completed, 0))),
  };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
