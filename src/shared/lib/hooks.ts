import { createContext, useContext, useEffect, useRef, useState } from 'react';

/** Tarayıcının çevrimiçi/çevrimdışı durumu. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Belirli aralıkla geri çağırım; `ms` null ise durur. Her zaman en güncel geri çağırımı kullanır. */
export function useInterval(callback: () => void, ms: number | null) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (ms === null) return;
    const id = window.setInterval(() => saved.current(), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

/** Pencere görünür mü (simge durumunda/gizliyken false). Yenilemeleri durdurmak için kullanılır. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

/**
 * Panel sahnede gösteriliyor mu. Shell, bağlı kalan ama etkin olmayan sekmeler için false verir;
 * sağlayıcı yoksa (ayrı pencere, alt çubuk) true kabul edilir.
 */
export const PanelVisibleContext = createContext(true);

/** Pencere görünür ve (varsa) panel sahnede gösteriliyor: periyodik yenilemeler bununla durdurulur. */
export function useActiveView(): boolean {
  const panelVisible = useContext(PanelVisibleContext);
  return usePageVisible() && panelVisible;
}

/** Her `ms` milisaniyede yeniden çizim tetikler (göreli zaman etiketleri için). */
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), ms);
  return now;
}
