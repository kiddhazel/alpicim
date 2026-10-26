/** Odak modu: saf durum mantığı (birim testli). Durum "focus" anahtarında tüm pencerelerde eşitlenir. */

export const FOCUS_KEY = 'focus';
/** Pomodoro widget'ının gönderdiği pencere olayı (detail: PomodoroSignal). */
export const POMODORO_SIGNAL_EVENT = 'alpicim:pomodoro-signal';

export interface FocusState {
  on: boolean;
  /** Pomodoro çalışma evresinin bitişi (ms); elle açıldıysa null. */
  endsAt: number | null;
  /** Pomodoro tarafından otomatik açıldı mı? (yalnız o zaman evre bitince kendiliğinden kapanır) */
  auto: boolean;
  /** Pomodoro çalışma evresi başlayınca otomatik açılsın mı? */
  autoPomodoro: boolean;
  /** Hata dışındaki bildirimler susturulsun mu? */
  suppressToasts: boolean;
  /** Etkin olmayan (ikincil) sahne panelleri soluklaşsın mı? */
  dim: boolean;
}

export const DEFAULT_FOCUS: FocusState = {
  on: false,
  endsAt: null,
  auto: false,
  autoPomodoro: true,
  suppressToasts: true,
  dim: true,
};

export function sanitizeFocus(raw: unknown): FocusState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof FocusState, unknown>>;
  const d = DEFAULT_FOCUS;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const endsAt = typeof r.endsAt === 'number' && Number.isFinite(r.endsAt) ? r.endsAt : null;
  const on = bool(r.on, d.on);
  return {
    on,
    endsAt: on ? endsAt : null,
    auto: on && bool(r.auto, false),
    autoPomodoro: bool(r.autoPomodoro, d.autoPomodoro),
    suppressToasts: bool(r.suppressToasts, d.suppressToasts),
    dim: bool(r.dim, d.dim),
  };
}

export interface PomodoroSignal {
  phase: 'work' | 'break';
  /** Çalışıyorsa bitiş zamanı (ms), duraklatılmışsa null. */
  endsAt: number | null;
}

/** Pomodoro durumuna göre yeni odak durumu; değişiklik yoksa aynı nesne döner. */
export function applyPomodoroSignal(state: FocusState, signal: PomodoroSignal): FocusState {
  if (signal.phase === 'work' && signal.endsAt !== null) {
    if (!state.autoPomodoro) return state;
    if (state.on && state.endsAt === signal.endsAt) return state;
    // Kullanıcı elle açtıysa "elle" olarak kalır (auto=false), yalnızca süre çipi eklenir.
    return { ...state, on: true, endsAt: signal.endsAt, auto: state.on ? state.auto : true };
  }
  if (state.on && state.auto) return { ...state, on: false, endsAt: null, auto: false };
  if (state.on && state.endsAt !== null) return { ...state, endsAt: null };
  return state;
}

export function setManual(state: FocusState, on: boolean): FocusState {
  return { ...state, on, endsAt: on ? state.endsAt : null, auto: false };
}

/** Çip metni: kalan süre "mm:ss", süre yoksa null. */
export function remainingLabel(endsAt: number | null, now: number): string | null {
  if (endsAt === null) return null;
  const s = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Bildirim gösterilmeli mi? Odak açık + susturma açıkken yalnız hatalar geçer. */
export function toastAllowed(tone: 'success' | 'error' | 'info', state: Pick<FocusState, 'on' | 'suppressToasts'>): boolean {
  return tone === 'error' || !(state.on && state.suppressToasts);
}
