import { useSyncExternalStore } from 'react';

/**
 * Yerel (native) alt webview'ler (uygulama içi tarayıcı) tüm HTML'in üstünde çizilir.
 * Menü, sürükleme gibi geçici katmanlar açıkken tarayıcının gizlenmesi için basit bir sayaç.
 */
const active = new Set<string>();
const listeners = new Set<() => void>();

export function setOverlay(key: string, on: boolean) {
  const had = active.has(key);
  if (on && !had) active.add(key);
  else if (!on && had) active.delete(key);
  else return;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useOverlayActive(): boolean {
  return useSyncExternalStore(subscribe, () => active.size > 0);
}
