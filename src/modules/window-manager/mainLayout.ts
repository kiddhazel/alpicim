import { sanitizeLayout, type MainLayout } from '../workspaces/workspaces';
import type { PanelId } from './panels';

export type { MainLayout } from '../workspaces/workspaces';

export const DEFAULT_MAIN_LAYOUT: MainLayout = {
  preset: null,
  docked: ['news', 'markets', 'launcher'],
  focused: 'news',
  weights: {},
  secondary: null,
};

export function sanitizeMainLayout(raw: unknown): MainLayout {
  return sanitizeLayout(raw, DEFAULT_MAIN_LAYOUT);
}

/** Paneli ana düzene ekler (zaten varsa yerinde bırakır) ve odaklar. */
export function dockPanel(layout: MainLayout, panel: PanelId): MainLayout {
  const docked = layout.docked.includes(panel) ? layout.docked : [...layout.docked, panel];
  return { ...layout, docked, focused: panel, secondary: layout.secondary === panel ? null : layout.secondary };
}

/** Paneli ana düzenden çıkarır. */
export function undockPanel(layout: MainLayout, panel: PanelId): MainLayout {
  const docked = layout.docked.filter((p) => p !== panel);
  const focused = layout.focused === panel ? (docked.find((p) => p !== layout.secondary) ?? docked[0] ?? layout.focused) : layout.focused;
  const secondary = layout.secondary === panel || layout.secondary === focused ? null : layout.secondary;
  return { ...layout, docked, focused, secondary };
}

/** İkinci (sağdaki) görünümü ayarlar; geçersizse (açık değil / birincil ile aynı) temizler. */
export function setSecondary(layout: MainLayout, panel: PanelId | null): MainLayout {
  const ok = panel !== null && panel !== layout.focused && layout.docked.includes(panel);
  return { ...layout, secondary: ok ? panel : null };
}

/** Paneli birincil görünüm yapar; ikincil ise ikincil boşalır. */
export function promote(layout: MainLayout, panel: PanelId): MainLayout {
  if (!layout.docked.includes(panel)) return layout;
  return { ...layout, focused: panel, secondary: layout.secondary === panel ? null : layout.secondary };
}

/** İki panelin ana düzendeki yerlerini değiştirir (sürükle-bırak). */
export function swapPanels(layout: MainLayout, a: PanelId, b: PanelId): MainLayout {
  const i = layout.docked.indexOf(a);
  const j = layout.docked.indexOf(b);
  if (i < 0 || j < 0 || i === j) return layout;
  const docked = [...layout.docked];
  docked[i] = b;
  docked[j] = a;
  return { ...layout, docked };
}

/** Paneli göster/gizle (hızlı ayarlar ve komut paleti için). */
export function togglePanel(layout: MainLayout, panel: PanelId): MainLayout {
  return layout.docked.includes(panel) ? undockPanel(layout, panel) : dockPanel(layout, panel);
}
