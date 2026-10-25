import { useCallback, useEffect, useState } from 'react';
import { currentWindowLabel } from '../../shared/lib/tauri';
import { adblockService, type AdblockStatus } from './adblockService';
import { browserWebviewLabel, hostOf } from './browserService';

export type ShieldState = 'unavailable' | 'disabled' | 'allowed' | 'active';

/** Alan adı, reklam engelleyici izin listesiyle karşılaştırılan biçimde (www. olmadan, küçük harf). */
export function siteHost(url: string): string {
  return url ? hostOf(url).replace(/:\d+$/, '').toLowerCase() : '';
}

export function shieldState(status: AdblockStatus | null, host: string): ShieldState {
  if (!status) return 'unavailable';
  if (!status.enabled) return 'disabled';
  if (host && status.allowlist.includes(host)) return 'allowed';
  return 'active';
}

/**
 * Tarayıcı araç çubuğundaki kalkan: sekme başına engellenen istek sayısı ve "bu sitede kapat/aç".
 * Arka uç hazır değilse (`adblock_*` komutları yok) kalkan gizlenir; panel çalışmaya devam eder.
 */
export function useTabAdblock(tabIds: readonly string[], focusedId: string, url: string, reload: () => void) {
  const [status, setStatus] = useState<AdblockStatus | null>(null);
  const [blocked, setBlocked] = useState<Record<string, number>>({});
  const host = siteHost(url);

  const refresh = useCallback(() => {
    adblockService
      .status()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  // Sekme ya da site değişince durumu tazele (ayarlardan açılıp kapatılmış olabilir).
  useEffect(() => {
    if (focusedId) refresh();
  }, [refresh, focusedId, host]);

  useEffect(() => {
    const prefix = browserWebviewLabel(currentWindowLabel(), '');
    return adblockService.onBlocked((e) => {
      if (!e.label.startsWith(prefix)) return;
      const tab = e.label.slice(prefix.length);
      setBlocked((b) => (b[tab] === e.blocked ? b : { ...b, [tab]: e.blocked }));
    });
  }, []);

  // Kapanan sekmelerin sayaçlarını at.
  const idsKey = tabIds.join('|');
  useEffect(() => {
    const ids = new Set(idsKey.split('|'));
    setBlocked((b) => {
      const stale = Object.keys(b).filter((k) => !ids.has(k));
      if (stale.length === 0) return b;
      const next = { ...b };
      stale.forEach((k) => delete next[k]);
      return next;
    });
  }, [idsKey]);

  const state = shieldState(status, host);

  const toggleSite = useCallback(async () => {
    if (!host || (state !== 'active' && state !== 'allowed')) return;
    try {
      setStatus(await adblockService.setSiteAllowed(host, state === 'active'));
      reload();
    } catch {
      refresh();
    }
  }, [host, state, reload, refresh]);

  return { state, host, blocked: blocked[focusedId] ?? 0, toggleSite };
}
