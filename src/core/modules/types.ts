import type { LucideIcon } from 'lucide-react';
import type { ComponentType, RefObject } from 'react';
import type { MessageKey } from '../../i18n';
import type { IntegrationId } from '../../modules/integrations/registry';
import type { PaletteItem } from '../../modules/palette/palette';
import type { Settings } from '../../modules/settings/settings';
import type { useToast } from '../../shared/ui/Toast';
import type { WidgetType } from '../../modules/widgets/types';
import type { PanelId } from '../../modules/window-manager/panels';

export type ModuleCategory = 'core' | 'work' | 'info' | 'media' | 'games' | 'system' | 'fun';

/** Kenar çubuğu ve Modüller sayfasındaki kategori sırası. */
export const MODULE_CATEGORIES: readonly ModuleCategory[] = ['core', 'work', 'info', 'media', 'games', 'system', 'fun'];

/** Panel bileşenine verilen ortak özellikler (modül bildirimi uyarlar). */
export interface PanelComponentProps {
  onOpenPanel: (p: PanelId) => void;
}

export interface PanelContribution {
  id: PanelId;
  titleKey: MessageKey;
  icon: LucideIcon;
  load: () => Promise<{ default: ComponentType<PanelComponentProps> }>;
}

/** Ayarlar'da modül bölümü. `id` küresel olarak benzersiz olmalı ve çekirdek bölüm kimlikleriyle çakışmamalı. */
export interface SettingsContribution {
  id: string;
  titleKey: MessageKey;
  descriptionKey?: MessageKey;
  icon: LucideIcon;
  load: () => Promise<{ default: ComponentType }>;
}

/** Palet komutlarının üretilirken kullandığı bağlam. */
export interface PaletteContext {
  openPanel: (p: PanelId) => void;
  settings: Settings;
  toast: ReturnType<typeof useToast>;
  focus: { on: boolean; toggle: () => void };
}

/**
 * Arka plan bileşeninin bağlandığı yer:
 * - app-all: her pencerede (App kökü); app-main: yalnız ana pencere (App);
 * - shell-logic / shell-background / shell-overlay: kabuk içinde (görünmez mantık / arka katman / üst katman).
 */
export type ServiceHostSlot = 'app-all' | 'app-main' | 'shell-logic' | 'shell-background' | 'shell-overlay';

export interface ServiceProps {
  openPanel?: (p: PanelId) => void;
  hostRef?: RefObject<HTMLElement | null>;
  panel?: PanelId;
}

export interface ServiceContribution {
  id: string;
  host: ServiceHostSlot;
  load: () => Promise<{ default: ComponentType<ServiceProps> }>;
}

export interface ModuleManifest {
  /** [a-z0-9-] */
  id: string;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  category: ModuleCategory;
  defaultEnabled: boolean;
  /** Kapatılamaz (Ana ekran, Ayarlar). */
  required?: boolean;
  panels?: readonly PanelContribution[];
  /**
   * Bu modülün widget türleri. Tanımlar (bileşen, varsayılan, sanitize) `widgets/widgetDefs.ts` içinde kalır;
   * böylece modül listesi bileşenleri eager yüklemez ve döngüsel içe aktarma oluşmaz.
   */
  widgets?: readonly WidgetType[];
  settings?: readonly SettingsContribution[];
  commands?: (ctx: PaletteContext) => PaletteItem[];
  services?: readonly ServiceContribution[];
  integrations?: readonly IntegrationId[];
}

export type ModuleStates = Record<string, boolean>;
