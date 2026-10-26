import type { LucideIcon } from 'lucide-react';
import { MODULES } from '../../core/modules';
import { panelsOf } from '../../core/modules/registry';
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
 * Kayıtlı TÜM paneller (modül bildirimlerinden türetilir; kapalı modüller dahil).
 * Yalnız etkin olanlar için `useEnabledPanels()` (core/modules/useModules.ts) kullanılır.
 * Yeni panel: modülün manifest.ts'ine panel + windows.rs → PANELS satırı + tr.ts başlığı + buradaki PanelId.
 */
export const PANELS: readonly PanelMeta[] = panelsOf(MODULES).map(({ id, titleKey, icon }) => ({ id, titleKey, icon }));

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
