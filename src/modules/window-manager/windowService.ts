import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { call, isTauri } from '../../shared/lib/tauri';
import type { PanelId } from './panels';

/** Rust tarafındaki düzen özeti (src-tauri/src/windows.rs → LayoutSnapshot). */
export interface LayoutSnapshot {
  detached: PanelId[];
  alwaysOnTop: Record<string, boolean>;
  closeToTray: boolean;
}

const LAYOUT_CHANGED = 'alpicim://layout-changed';

const EMPTY: LayoutSnapshot = { detached: [], alwaysOnTop: {}, closeToTray: true };

export const windowService = {
  async getLayout(): Promise<LayoutSnapshot> {
    if (!isTauri()) return EMPTY;
    return call<LayoutSnapshot>('layout_get');
  },

  onLayoutChanged(cb: (snapshot: LayoutSnapshot) => void): () => void {
    if (!isTauri()) return () => {};
    let off: (() => void) | null = null;
    let disposed = false;
    void listen<LayoutSnapshot>(LAYOUT_CHANGED, (e) => cb(e.payload)).then((fn) => {
      if (disposed) fn();
      else off = fn;
    });
    return () => {
      disposed = true;
      off?.();
    };
  },

  openPanelWindow(panel: PanelId) {
    return call<void>('panel_open_window', { panel });
  },

  closePanelWindow(panel: PanelId) {
    return call<void>('panel_close_window', { panel });
  },

  setAlwaysOnTop(value: boolean) {
    return call<void>('window_set_always_on_top', { value });
  },

  setCloseToTray(value: boolean) {
    return call<void>('layout_set_close_to_tray', { value });
  },

  quitApp() {
    return call<void>('app_quit');
  },

  async minimize() {
    if (isTauri()) await getCurrentWindow().minimize();
  },

  async toggleMaximize() {
    if (isTauri()) await getCurrentWindow().toggleMaximize();
  },

  /** Ana pencerede: ayara göre tepsiye gizler (Rust karar verir). */
  async closeCurrent() {
    if (isTauri()) await getCurrentWindow().close();
  },
};
