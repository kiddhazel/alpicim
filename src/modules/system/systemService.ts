import { useCallback, useEffect, useRef, useState } from 'react';
import { useInterval } from '../../shared/lib/hooks';
import { AppError, call, isTauri } from '../../shared/lib/tauri';

/** Rust → system.rs */
export interface SystemStats {
  cpu: number | null;
  memoryUsed: number;
  memoryTotal: number;
  diskName: string;
  diskUsed: number;
  diskTotal: number;
}

export type MediaStatus = 'playing' | 'paused' | 'stopped' | 'changing' | 'closed' | 'opened';

export interface MediaSession {
  appId: string;
  own: boolean;
  title: string;
  artist: string;
  album: string;
  status: MediaStatus;
  canPlayPause: boolean;
  canNext: boolean;
  canPrevious: boolean;
  /** Konum örneği (ms); oturum bildirmiyorsa null. */
  positionMs: number | null;
  durationMs: number | null;
  /** Konumun örneklendiği an (Unix ms). */
  updatedAtMs: number | null;
}

/** Oynatılıyorsa örnekleme anından beri geçen süre eklenir; [0, süre] aralığına sıkıştırılır. */
export function currentPositionMs(
  session: Pick<MediaSession, 'status' | 'positionMs' | 'durationMs' | 'updatedAtMs'>,
  nowMs: number,
): number | null {
  if (session.positionMs === null || !Number.isFinite(session.positionMs)) return null;
  let pos = session.positionMs;
  if (session.status === 'playing' && session.updatedAtMs !== null) pos += nowMs - session.updatedAtMs;
  if (session.durationMs !== null && session.durationMs > 0) pos = Math.min(pos, session.durationMs);
  return Math.max(0, pos);
}

/** Milisaniye → "m:ss" (bir saati aşarsa "h:mm:ss"). */
export function formatTrackTime(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export type MediaAction = 'playPause' | 'next' | 'previous';

export const systemService = {
  stats: () => call<SystemStats>('system_stats'),
  mediaSessions: () => call<MediaSession[]>('media_sessions'),
  mediaCommand: (action: MediaAction, preferOwn: boolean) => call<boolean>('media_command', { action, preferOwn }),
};

/** Bayt → "12,3 GB" */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: value >= 100 ? 0 : 1 })} ${units[i]}`;
}

export function percent(used: number, total: number): number | null {
  return total > 0 ? Math.round((used / total) * 100) : null;
}

/** Uygulama kimliğinden okunabilir kaynak adı (ör. "Spotify.exe" → "Spotify"). */
export function sourceName(appId: string): string {
  const last = appId.split(/[\\/!]/).filter(Boolean).pop() ?? appId;
  const clean = last.replace(/\.exe$/i, '').replace(/_[a-z0-9]{13}$/i, '');
  const known: Record<string, string> = {
    chrome: 'Chrome',
    msedge: 'Edge',
    spotify: 'Spotify',
    firefox: 'Firefox',
    msedgewebview2: 'YouTube Music (Alpicim)',
  };
  const base = clean.split('.').pop() ?? clean;
  return known[base.toLowerCase()] ?? (/alpicim/i.test(appId) ? 'Alpicim' : base);
}

/** Sistem kaynaklarını `intervalMs` aralıkla okur; `active` false iken durur. */
export function useSystemStats(intervalMs: number, active: boolean) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [error, setError] = useState<unknown>(() => (isTauri() ? null : new AppError('NOT_DESKTOP')));
  const busy = useRef(false);
  const pull = useCallback(() => {
    if (!isTauri() || busy.current) return;
    busy.current = true;
    systemService
      .stats()
      .then((s) => {
        setStats(s);
        setError(null);
      })
      .catch(setError)
      .finally(() => {
        busy.current = false;
      });
  }, []);
  useEffect(() => {
    if (active) pull();
  }, [active, pull]);
  useInterval(pull, active ? intervalMs : null);
  return { stats, error };
}

/**
 * Windows medya oturumu (SMTC). `preferOwn` → Alpicim (YouTube Music) oturumu varsa o gösterilir,
 * yoksa Windows'un geçerli oturumu.
 */
export function useMediaSession(intervalMs: number, active: boolean, preferOwn = true) {
  const [session, setSession] = useState<MediaSession | null>(null);
  const [error, setError] = useState<unknown>(null);
  const busy = useRef(false);
  const pull = useCallback(() => {
    if (!isTauri() || busy.current) return;
    busy.current = true;
    systemService
      .mediaSessions()
      .then((list) => {
        setSession((preferOwn ? list.find((s) => s.own) : undefined) ?? list[0] ?? null);
        setError(null);
      })
      .catch(setError)
      .finally(() => {
        busy.current = false;
      });
  }, [preferOwn]);
  useEffect(() => {
    if (active) pull();
  }, [active, pull]);
  useInterval(pull, active ? intervalMs : null);

  const command = useCallback(
    async (action: MediaAction) => {
      await systemService.mediaCommand(action, preferOwn);
      window.setTimeout(pull, 350);
    },
    [preferOwn, pull],
  );
  return { session, error, command, refresh: pull };
}
