import {
  AppWindow,
  ClipboardList,
  Gamepad2,
  Library,
  Sofa,
  Globe,
  LayoutDashboard,
  Music2,
  Newspaper,
  Podcast,
  Radio,
  NotebookPen,
  PictureInPicture2,
  Settings as SettingsIcon,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { MessageKey } from '../../i18n';

export type PanelId =
  | 'home'
  | 'news'
  | 'markets'
  | 'launcher'
  | 'browser'
  | 'music'
  | 'apps'
  | 'notes'
  | 'clipboard'
  | 'games'
  | 'library'
  | 'room'
  | 'radio'
  | 'podcasts'
  | 'settings';

export interface PanelMeta {
  id: PanelId;
  titleKey: MessageKey;
  icon: LucideIcon;
}

/**
 * Panel kaydı. Yeni modül eklemek için buraya bir kayıt, PanelHost'a bir bileşen,
 * src-tauri/src/windows.rs → PANELS'e bir satır ve tr.ts'e başlık eklenir.
 */
export const PANELS: readonly PanelMeta[] = [
  { id: 'home', titleKey: 'panels.home', icon: LayoutDashboard },
  { id: 'news', titleKey: 'panels.news', icon: Newspaper },
  { id: 'markets', titleKey: 'panels.markets', icon: TrendingUp },
  { id: 'launcher', titleKey: 'panels.launcher', icon: AppWindow },
  { id: 'browser', titleKey: 'panels.browser', icon: Globe },
  { id: 'music', titleKey: 'panels.music', icon: Music2 },
  { id: 'apps', titleKey: 'panels.apps', icon: PictureInPicture2 },
  { id: 'notes', titleKey: 'panels.notes', icon: NotebookPen },
  { id: 'clipboard', titleKey: 'panels.clipboard', icon: ClipboardList },
  { id: 'games', titleKey: 'panels.games', icon: Gamepad2 },
  { id: 'library', titleKey: 'panels.library', icon: Library },
  { id: 'room', titleKey: 'panels.room', icon: Sofa },
  { id: 'radio', titleKey: 'panels.radio', icon: Radio },
  { id: 'podcasts', titleKey: 'panels.podcasts', icon: Podcast },
  { id: 'settings', titleKey: 'panels.settings', icon: SettingsIcon },
];

export function isPanelId(value: unknown): value is PanelId {
  return PANELS.some((p) => p.id === value);
}

export function panelMeta(id: PanelId): PanelMeta {
  return PANELS.find((p) => p.id === id) ?? (PANELS[0] as PanelMeta);
}

export function panelFromLabel(label: string): PanelId | null {
  const id = label.startsWith('panel-') ? label.slice('panel-'.length) : null;
  return isPanelId(id) ? id : null;
}
