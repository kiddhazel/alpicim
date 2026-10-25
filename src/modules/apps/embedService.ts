import { usePersistentState } from '../../shared/lib/usePersistentState';
import { call } from '../../shared/lib/tauri';
import type { Bounds } from '../../shared/lib/useNativeBounds';

/** Rust → embed.rs::WindowInfo */
export interface WindowInfo {
  hwnd: number;
  title: string;
  processName: string;
  exePath: string;
  pid: number;
  className: string;
  embeddable: boolean;
  reason: string | null;
}

/**
 * Paneldeki bir sekme. `embedded`: gerçek pencere panelin içinde; `card`: gömülemeyen uygulama için
 * kart (öne getir düğmesiyle). HWND yalnızca o oturumda geçerlidir; yeniden açılışta exe yolu ile yeniden bulunur.
 */
export interface AppTab {
  id: string;
  mode: 'embedded' | 'card';
  hwnd: number | null;
  title: string;
  processName: string;
  exePath: string;
}

export const APPS_TABS_KEY = 'apps.tabs';

export function sanitizeTabs(raw: unknown): AppTab[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .filter((x) => typeof x.id === 'string' && typeof x.exePath === 'string')
    .slice(0, 12)
    .map((x) => ({
      id: x.id as string,
      mode: x.mode === 'card' ? 'card' : 'embedded',
      hwnd: typeof x.hwnd === 'number' && Number.isFinite(x.hwnd) ? x.hwnd : null,
      title: typeof x.title === 'string' ? x.title.slice(0, 200) : '',
      processName: typeof x.processName === 'string' ? x.processName.slice(0, 120) : '',
      exePath: x.exePath as string,
    }));
}

export function useAppTabs() {
  return usePersistentState<AppTab[]>(APPS_TABS_KEY, [], sanitizeTabs);
}

export function tabFromWindow(w: WindowInfo, mode: AppTab['mode']): AppTab {
  return {
    id: `tab-${w.hwnd}-${Date.now().toString(36)}`,
    mode,
    hwnd: w.hwnd,
    title: w.title,
    processName: w.processName,
    exePath: w.exePath,
  };
}

/** Kısa görünen ad: "Discord.exe" → "Discord". */
export function appName(tab: Pick<AppTab, 'processName' | 'title'>): string {
  const base = tab.processName.replace(/\.exe$/i, '');
  return base || tab.title || '?';
}

export const embedService = {
  list: () => call<WindowInfo[]>('embed_list'),
  /** Kullanıcı `timeoutMs` içinde başka bir pencereye tıklarsa o pencere döner. */
  pick: (timeoutMs = 15_000) => call<WindowInfo | null>('embed_pick', { timeoutMs }),
  attach: (hwnd: number, b: Bounds) => call<WindowInfo>('embed_attach', { hwnd, ...b }),
  setBounds: (hwnd: number, b: Bounds, visible: boolean) => call<void>('embed_set_bounds', { hwnd, ...b, visible }),
  focus: (hwnd: number) => call<void>('embed_focus', { hwnd }),
  release: (hwnd: number) => call<void>('embed_release', { hwnd }),
  alive: () => call<number[]>('embed_alive'),
  info: (hwnd: number) => call<WindowInfo | null>('embed_info', { hwnd }),
  findExe: (exe: string) => call<WindowInfo | null>('embed_find_exe', { exe }),
  activate: (hwnd: number) => call<void>('embed_activate', { hwnd }),
  /** Pencere bu süreçte daha önce gömüldü mü? */
  known: (hwnd: number) => call<boolean>('embed_known', { hwnd }),
};
