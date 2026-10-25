import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauri } from '../../shared/lib/tauri';
import { adblockService, type AdblockStatus } from './adblockService';

export type AdblockBusy = 'toggle' | 'update' | 'site' | null;

/** Reklam engelleyici durumu + işlemler (ayarlar bölümü için). Hatalar çağırana fırlatılır. */
export function useAdblock() {
  const desktop = isTauri();
  const [status, setStatus] = useState<AdblockStatus | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [busy, setBusy] = useState<AdblockBusy>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!desktop) return;
    try {
      const next = await adblockService.status();
      if (mounted.current) {
        setStatus(next);
        setLoadError(null);
      }
    } catch (err) {
      if (mounted.current) setLoadError(err);
    }
  }, [desktop]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  // İlk indirme / güncelleme sürerken durumu seyrek yokla.
  const pending = !!status && (status.updating || (status.enabled && !status.ready));
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(id);
  }, [pending, refresh]);

  // Engellenen toplamı canlı tut (en sık 2 sn'de bir).
  useEffect(() => {
    let timer: number | null = null;
    const off = adblockService.onBlocked(() => {
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        void refresh();
      }, 2000);
    });
    return () => {
      off();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [refresh]);

  const run = useCallback(async (kind: Exclude<AdblockBusy, null>, action: () => Promise<AdblockStatus>) => {
    setBusy(kind);
    try {
      const next = await action();
      if (mounted.current) setStatus(next);
      return next;
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, []);

  return {
    desktop,
    status,
    loadError,
    busy,
    setEnabled: (enabled: boolean) => run('toggle', () => adblockService.setEnabled(enabled)),
    updateLists: () => run('update', () => adblockService.update()),
    allowSite: (host: string) => run('site', () => adblockService.setSiteAllowed(host, true)),
    removeSite: (host: string) => run('site', () => adblockService.setSiteAllowed(host, false)),
  };
}
