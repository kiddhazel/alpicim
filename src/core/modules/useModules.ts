import { useCallback, useMemo } from 'react';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { WIDGETS } from '../../modules/widgets/registry';
import type { WidgetDefinition, WidgetType } from '../../modules/widgets/types';
import type { PanelMeta } from '../../modules/window-manager/panels';
import { MODULES } from './index';
import {
  defaultModuleStates,
  enabledIds,
  enabledModules,
  panelsOf,
  sanitizeModuleStates,
  widgetTypesOf,
} from './registry';
import type { ModuleManifest, ModuleStates } from './types';

export const MODULES_KEY = 'modules';

/** Modül açık/kapalı durumları (pencereler arasında eşitlenir). Yüklenene dek varsayılanlar geçerlidir. */
export function useModuleStates() {
  return usePersistentState<ModuleStates>(MODULES_KEY, defaultModuleStates(MODULES), (raw) => sanitizeModuleStates(raw, MODULES));
}

export function useModules() {
  const [states, setStates, loaded] = useModuleStates();
  const enabled = useMemo(() => enabledIds(MODULES, states), [states]);
  const isEnabled = useCallback((id: string) => enabled.has(id), [enabled]);
  const setEnabled = useCallback(
    (id: string, value: boolean) => {
      const m = MODULES.find((x) => x.id === id);
      if (!m || m.required) return;
      setStates((s) => ({ ...s, [id]: value }));
    },
    [setStates],
  );
  const active = useMemo<ModuleManifest[]>(() => enabledModules(MODULES, states), [states]);
  return { states, enabled, isEnabled, setEnabled, active, loaded };
}

export function useModuleEnabled(id: string): boolean {
  return useModules().isEnabled(id);
}

/** Etkin modüllerin panelleri (kenar çubuğu / palet / sekmeler). `PANELS` ise tüm kayıtlıların listesidir. */
export function useEnabledPanels(): readonly PanelMeta[] {
  const { active } = useModules();
  return useMemo(() => panelsOf(active).map(({ id, titleKey, icon }) => ({ id, titleKey, icon })), [active]);
}

export function useEnabledWidgetTypes(): ReadonlySet<WidgetType> {
  const { active } = useModules();
  return useMemo(() => new Set(widgetTypesOf(active)), [active]);
}

/** Eklenebilir widget tanımları (yalnız etkin modüllerin). */
export function useEnabledWidgetDefs(): readonly WidgetDefinition<Record<string, unknown>>[] {
  const types = useEnabledWidgetTypes();
  return useMemo(() => WIDGETS.filter((d) => types.has(d.type)), [types]);
}
