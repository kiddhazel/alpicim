/** Ses mikseri: Rust `mixer_list` yanıtının doğrulanması ve yardımcılar (saf, birim testli). */

export interface MixerSession {
  id: string;
  name: string;
  exe: string | null;
  /** 0..1 */
  volume: number;
  muted: boolean;
  system: boolean;
  active: boolean;
}

export interface MixerState {
  master: number;
  masterMuted: boolean;
  sessions: MixerSession[];
}

export const EMPTY_MIXER: MixerState = { master: 0, masterMuted: false, sessions: [] };
export const MASTER_ID = 'master';
const MAX_SESSIONS = 40;

function unit(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0;
}

export function sanitizeMixer(raw: unknown): MixerState {
  if (!raw || typeof raw !== 'object') return EMPTY_MIXER;
  const r = raw as Record<string, unknown>;
  const sessions: MixerSession[] = [];
  if (Array.isArray(r.sessions)) {
    for (const item of r.sessions.slice(0, MAX_SESSIONS)) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;
      if (typeof s.id !== 'string' || !s.id) continue;
      sessions.push({
        id: s.id,
        name: typeof s.name === 'string' ? s.name : '',
        exe: typeof s.exe === 'string' ? s.exe : null,
        volume: unit(s.volume),
        muted: s.muted === true,
        system: s.system === true,
        active: s.active === true,
      });
    }
  }
  return { master: unit(r.master), masterMuted: r.masterMuted === true, sessions };
}

export function toPercent(v: number): number {
  return Math.round(unit(v) * 100);
}

/** Kaydırıcı değeri (0..100) → 0..1. */
export function fromPercent(p: number): number {
  return Number.isFinite(p) ? Math.min(Math.max(p, 0), 100) / 100 : 0;
}

/** Tek bir oturumun yerel (iyimser) güncellemesi. */
export function patchSession(state: MixerState, id: string, patch: { volume?: number; muted?: boolean }): MixerState {
  if (id === MASTER_ID) {
    return { ...state, master: patch.volume ?? state.master, masterMuted: patch.muted ?? state.masterMuted };
  }
  return { ...state, sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}
