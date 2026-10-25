import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';
import { call, isTauri } from '../../shared/lib/tauri';

/** Rust → display.rs */
export type DisplayMode = 'window' | 'fullscreen';

export interface MonitorView {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  primary: boolean;
  current: boolean;
  target: boolean;
}

export interface DisplaySnapshot {
  prefs: { mode: DisplayMode; monitor: string | null };
  monitors: MonitorView[];
  fullscreen: boolean;
}

export type ShortcutAction = 'toggleVisible' | 'toggleFullscreen' | 'palette';

export interface ShortcutStatus {
  action: ShortcutAction;
  accelerator: string;
  defaultAccelerator: string;
  error: string | null;
}

const DISPLAY_CHANGED = 'alpicim://display-changed';
export const PALETTE_EVENT = 'alpicim://palette';

export const EMPTY_DISPLAY: DisplaySnapshot = { prefs: { mode: 'window', monitor: null }, monitors: [], fullscreen: false };

export const displayService = {
  get: () => call<DisplaySnapshot>('display_get'),
  set: (mode: DisplayMode, monitor: string | null) => call<DisplaySnapshot>('display_set', { mode, monitor }),
  moveToTarget: () => call<DisplaySnapshot>('display_move_to_target'),
  toggleFullscreen: () => call<void>('display_toggle_fullscreen'),
  hideMain: () => call<void>('app_hide_main'),
  setStartHidden: (value: boolean) => call<void>('layout_set_start_hidden', { value }),
  getShortcuts: () => call<ShortcutStatus[]>('shortcuts_get'),
  setShortcuts: (bindings: Partial<Record<ShortcutAction, string>>) => call<ShortcutStatus[]>('shortcuts_set', { bindings }),
  getAutostart: () => call<boolean>('autostart_get'),
  setAutostart: (enabled: boolean) => call<void>('autostart_set', { enabled }),

  onChanged(cb: (s: DisplaySnapshot) => void): () => void {
    return subscribe<DisplaySnapshot>(DISPLAY_CHANGED, cb);
  },
};

/** Tauri olayına abone olur; bileşen kalkınca güvenle bırakır. */
export function subscribe<T>(event: string, cb: (payload: T) => void): () => void {
  if (!isTauri()) return () => {};
  let off: (() => void) | null = null;
  let disposed = false;
  void listen<T>(event, (e) => cb(e.payload)).then((fn) => {
    if (disposed) fn();
    else off = fn;
  });
  return () => {
    disposed = true;
    off?.();
  };
}

/** Monitör listesi ve ekran tercihi (değişiklik olaylarını izler). */
export function useDisplay() {
  const [snapshot, setSnapshot] = useState<DisplaySnapshot>(EMPTY_DISPLAY);
  const refresh = useCallback(() => {
    if (!isTauri()) return;
    displayService.get().then(setSnapshot).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    const off = displayService.onChanged(setSnapshot);
    // Tam ekran başka yoldan (kısayol, tepsi) değişebilir; pencere boyutu değişince tazele.
    let frame = 0;
    const onResize = () => {
      window.clearTimeout(frame);
      frame = window.setTimeout(refresh, 250);
    };
    window.addEventListener('resize', onResize);
    return () => {
      off();
      window.clearTimeout(frame);
      window.removeEventListener('resize', onResize);
    };
  }, [refresh]);
  return { snapshot, setSnapshot, refresh };
}

/** "\\.\DISPLAY2" → 2; çözülemezse sıra numarası. */
export function monitorNumber(m: MonitorView, index: number): number {
  const match = /DISPLAY(\d+)/i.exec(m.id);
  return match ? Number(match[1]) : index + 1;
}

/** Klavye olayını "Ctrl+Alt+F" biçimine çevirir; yalnız değiştirici tuşa basıldıysa null. */
export function formatAccelerator(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string | null {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Win');
  let key: string | null = null;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)) key = e.code;
  else {
    const named: Record<string, string> = {
      Space: 'Space',
      Enter: 'Enter',
      Tab: 'Tab',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown',
      Insert: 'Insert',
      Delete: 'Delete',
    };
    key = named[e.code] ?? null;
  }
  if (!key) return null;
  parts.push(key);
  return parts.join('+');
}
