import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import type { MessageKey } from '../../i18n';
import type { GridItem, SizeLimits } from './grid';

export type WidgetType =
  | 'clock'
  | 'weather'
  | 'notes'
  | 'todo'
  | 'pomodoro'
  | 'system'
  | 'favorites'
  | 'news'
  | 'markets'
  | 'music'
  | 'windows'
  | 'calendar'
  | 'links'
  | 'habits'
  | 'countdown'
  | 'converter'
  | 'quicknote';

/** Kalıcı widget kaydı: ızgara konumu + tür + widget'a özel ayarlar. */
export interface WidgetInstance extends GridItem {
  type: WidgetType;
  config: Record<string, unknown>;
  /** Devre dışı: bileşen çalıştırılmaz (yenileme yapmaz), yalnızca yer tutucu görünür. */
  disabled?: boolean;
}

export interface WidgetProps<C> {
  id: string;
  config: C;
  setConfig: (patch: Partial<C>) => void;
  /** Izgara birimi cinsinden boyut; widget küçük/büyük görünümü buna göre seçer. */
  size: { w: number; h: number };
  /** Pencere görünür ve performans modu izin veriyorsa true; false iken yenileme yapılmamalı. */
  active: boolean;
}

export interface WidgetSettingsProps<C> {
  config: C;
  setConfig: (patch: Partial<C>) => void;
}

export interface WidgetDefinition<C = Record<string, unknown>> {
  type: WidgetType;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  defaultSize: { w: number; h: number };
  limits: SizeLimits;
  defaults: C;
  sanitize: (raw: unknown) => C;
  Component: ComponentType<WidgetProps<C>>;
  Settings?: ComponentType<WidgetSettingsProps<C>>;
}

/** Ayar doğrulama yardımcıları (widget'lar ortak kullanır). */
export function obj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export function num(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function str(value: unknown, fallback: string, maxLength = 200): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}
