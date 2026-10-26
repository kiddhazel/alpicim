import { useCallback, useEffect, useRef, useState } from 'react';
import { useInterval } from '../../shared/lib/hooks';
import { AppError, call, isTauri } from '../../shared/lib/tauri';
import { EMPTY_MIXER, patchSession, sanitizeMixer, type MixerState } from './mixer';

/** Rust → mixer.rs komutları. */
export const mixerService = {
  list: async () => sanitizeMixer(await call<unknown>('mixer_list')),
  setVolume: (id: string, volume: number) => call<void>('mixer_set_volume', { id, volume }),
  setMute: (id: string, muted: boolean) => call<void>('mixer_set_mute', { id, muted }),
  icon: (exe: string) => call<string | null>('mixer_icon', { exe }),
};

const POLL_MS = 3000;
/** Kullanıcı ayar yaptıktan sonra bu süre boyunca yoklama sonucu yerel değeri ezmez. */
const HOLD_MS = 1200;

/** Mikser durumu; yalnızca `active` iken 3 sn'de bir yoklanır. */
export function useMixer(active: boolean) {
  const [state, setState] = useState<MixerState>(EMPTY_MIXER);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(() => (isTauri() ? null : new AppError('NOT_DESKTOP')));
  const busy = useRef(false);
  const holdUntil = useRef(0);
  const pending = useRef<Map<string, number>>(new Map());

  const pull = useCallback(() => {
    if (!isTauri() || busy.current) return;
    busy.current = true;
    mixerService
      .list()
      .then((s) => {
        if (Date.now() >= holdUntil.current) setState(s);
        setLoaded(true);
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
  useInterval(pull, active ? POLL_MS : null);

  const setVolume = useCallback((id: string, volume: number) => {
    holdUntil.current = Date.now() + HOLD_MS;
    setState((s) => patchSession(s, id, { volume }));
    // Aynı kimlik için sürüklerken istekleri seyrelt: son değer her zaman gönderilir.
    const prev = pending.current.get(id);
    if (prev !== undefined) window.clearTimeout(prev);
    pending.current.set(
      id,
      window.setTimeout(() => {
        pending.current.delete(id);
        void mixerService.setVolume(id, volume).catch(setError);
      }, 60),
    );
  }, []);

  const setMute = useCallback((id: string, muted: boolean) => {
    holdUntil.current = Date.now() + HOLD_MS;
    setState((s) => patchSession(s, id, { muted }));
    void mixerService.setMute(id, muted).catch(setError);
  }, []);

  useEffect(
    () => () => {
      for (const h of pending.current.values()) window.clearTimeout(h);
    },
    [],
  );

  return { state, loaded, error, setVolume, setMute };
}

const iconCache = new Map<string, string | null>();

/** exe yoluna göre simge (önbellekli); bulunamazsa null. */
export function useExeIcon(exe: string | null): string | null {
  const [icon, setIcon] = useState<string | null>(() => (exe ? (iconCache.get(exe) ?? null) : null));
  useEffect(() => {
    if (!exe || !isTauri()) return;
    if (iconCache.has(exe)) {
      setIcon(iconCache.get(exe) ?? null);
      return;
    }
    let alive = true;
    mixerService
      .icon(exe)
      .then((url) => {
        iconCache.set(exe, url);
        if (alive) setIcon(url);
      })
      .catch(() => iconCache.set(exe, null));
    return () => {
      alive = false;
    };
  }, [exe]);
  return icon;
}
