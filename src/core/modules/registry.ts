import type { PaletteItem } from '../../modules/palette/palette';
import type { WidgetType } from '../../modules/widgets/types';
import type { PanelId } from '../../modules/window-manager/panels';
import {
  MODULE_CATEGORIES,
  type ModuleCategory,
  type ModuleManifest,
  type ModuleStates,
  type PaletteContext,
  type PanelContribution,
  type ServiceContribution,
  type ServiceHostSlot,
  type SettingsContribution,
} from './types';

/**
 * Saf türetme işlevleri: modül listesi + etkin durumu → paneller, widget türleri, ayar bölümleri, komutlar, servisler.
 * Bileşenler modül listesini elle bilmez; bunların çıktısını kullanır. Hepsi `modules` parametresini alır (testlenebilir).
 */

export const MODULE_ID_PATTERN = /^[a-z0-9-]+$/;

export function defaultModuleStates(modules: readonly ModuleManifest[]): ModuleStates {
  return Object.fromEntries(modules.map((m) => [m.id, m.required ? true : m.defaultEnabled]));
}

/** Depodan gelen veriyi doğrular: bilinmeyen kimlikler atılır, eksikler varsayılana düşer, zorunlu modüller hep açık. */
export function sanitizeModuleStates(raw: unknown, modules: readonly ModuleManifest[]): ModuleStates {
  const out = defaultModuleStates(modules);
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const m of modules) {
    if (m.required) continue;
    const v = r[m.id];
    if (typeof v === 'boolean') out[m.id] = v;
  }
  return out;
}

export function isModuleEnabled(states: ModuleStates, module: ModuleManifest): boolean {
  return module.required ? true : (states[module.id] ?? module.defaultEnabled);
}

export function enabledModules(modules: readonly ModuleManifest[], states: ModuleStates): ModuleManifest[] {
  return modules.filter((m) => isModuleEnabled(states, m));
}

export function enabledIds(modules: readonly ModuleManifest[], states: ModuleStates): Set<string> {
  return new Set(enabledModules(modules, states).map((m) => m.id));
}

export function panelsOf(modules: readonly ModuleManifest[]): PanelContribution[] {
  return modules.flatMap((m) => m.panels ?? []);
}

export function widgetTypesOf(modules: readonly ModuleManifest[]): WidgetType[] {
  return modules.flatMap((m) => m.widgets ?? []);
}

export function settingsOf(modules: readonly ModuleManifest[]): { module: ModuleManifest; section: SettingsContribution }[] {
  return modules.flatMap((m) => (m.settings ?? []).map((section) => ({ module: m, section })));
}

export function servicesOf(
  modules: readonly ModuleManifest[],
  host: ServiceHostSlot | readonly ServiceHostSlot[],
): { module: ModuleManifest; service: ServiceContribution }[] {
  const hosts = typeof host === 'string' ? [host] : host;
  return modules.flatMap((m) => (m.services ?? []).filter((s) => hosts.includes(s.host)).map((service) => ({ module: m, service })));
}

export function commandsOf(modules: readonly ModuleManifest[], ctx: PaletteContext): PaletteItem[] {
  return modules.flatMap((m) => m.commands?.(ctx) ?? []);
}

export function moduleOfPanel(modules: readonly ModuleManifest[], id: PanelId): ModuleManifest | undefined {
  return modules.find((m) => m.panels?.some((p) => p.id === id));
}

export function moduleOfWidget(modules: readonly ModuleManifest[], type: WidgetType): ModuleManifest | undefined {
  return modules.find((m) => m.widgets?.includes(type));
}

export function groupByCategory(modules: readonly ModuleManifest[]): { category: ModuleCategory; modules: ModuleManifest[] }[] {
  return MODULE_CATEGORIES.map((category) => ({ category, modules: modules.filter((m) => m.category === category) })).filter(
    (g) => g.modules.length > 0,
  );
}
