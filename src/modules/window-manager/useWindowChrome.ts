import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useState } from 'react';
import { currentWindowLabel, isTauri } from '../../shared/lib/tauri';
import { windowService, type LayoutSnapshot } from './windowService';

/** Geçerli pencere için başlık çubuğu durumu: üstte tutma, büyütülmüş mü, düzen özeti. */
export function useWindowChrome() {
  const label = currentWindowLabel();
  const [layout, setLayout] = useState<LayoutSnapshot>({ detached: [], alwaysOnTop: {}, closeToTray: true });
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let alive = true;
    windowService
      .getLayout()
      .then((snap) => alive && setLayout(snap))
      .catch(() => {});
    const off = windowService.onLayoutChanged((snap) => setLayout(snap));
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    let unlisten: (() => void) | null = null;
    let disposed = false;
    const sync = () => {
      win
        .isMaximized()
        .then((v) => !disposed && setMaximized(v))
        .catch(() => {});
    };
    sync();
    void win.onResized(sync).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const pinned = layout.alwaysOnTop[label] ?? false;

  const togglePin = useCallback(async () => {
    const next = !pinned;
    setLayout((l) => ({ ...l, alwaysOnTop: { ...l.alwaysOnTop, [label]: next } }));
    try {
      await windowService.setAlwaysOnTop(next);
    } catch {
      setLayout((l) => ({ ...l, alwaysOnTop: { ...l.alwaysOnTop, [label]: !next } }));
    }
  }, [label, pinned]);

  return { label, layout, pinned, maximized, togglePin };
}
