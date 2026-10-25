import { readKey, writeKey } from '../../shared/lib/store';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { normalize } from '../widgets/grid';
import type { WidgetInstance, WidgetType } from '../widgets/types';
import { isPanelId, type PanelId } from '../window-manager/panels';
import type { LayoutPreset } from '../settings/settings';

/**
 * Çalışma alanı: kendi panel düzeni (görünür paneller, düzen, panel genişlikleri) ve widget yerleşimi.
 * Hepsi `alpicim.json` → "workspaces" anahtarında saklanır.
 */

export type WorkspaceIcon = 'home' | 'briefcase' | 'newspaper' | 'music' | 'star';

export interface MainLayout {
  /** null → ayarlardaki varsayılan düzen kullanılır. */
  preset: LayoutPreset | null;
  /** Ana pencerede gösterilen paneller (sırasıyla). */
  docked: PanelId[];
  /** Odak düzeninde gösterilen panel. */
  focused: PanelId;
  /** Panel genişlik ağırlıkları (birincil ve ikincil görünüm bu oranla paylaşır). */
  weights: Partial<Record<PanelId, number>>;
  /** Birincil görünümün yanında sabitlenen ikinci görünüm (docked içinde ve odaktakinden farklı olmalı). */
  secondary: PanelId | null;
}

export interface Workspace {
  id: string;
  name: string;
  icon: WorkspaceIcon;
  layout: MainLayout;
  widgets: WidgetInstance[];
}

export interface WorkspaceStore {
  activeId: string;
  /** Açılışta kullanılacak çalışma alanı: "last" (son kullanılan) veya bir kimlik. */
  startup: string;
  items: Workspace[];
}

export const WORKSPACES_KEY = 'workspaces';

const ICONS: readonly WorkspaceIcon[] = ['home', 'briefcase', 'newspaper', 'music', 'star'];
const WIDGET_TYPES: readonly WidgetType[] = [
  'clock',
  'weather',
  'notes',
  'todo',
  'pomodoro',
  'system',
  'favorites',
  'news',
  'markets',
  'music',
  'windows',
  'calendar',
  'links',
  'habits',
  'countdown',
  'converter',
  'quicknote',
];

function w(id: string, type: WidgetType, x: number, y: number, ww: number, h: number): WidgetInstance {
  return { id, type, x, y, w: ww, h, config: {} };
}

function layout(docked: PanelId[], preset: LayoutPreset | null): MainLayout {
  return { preset, docked, focused: docked[0] ?? 'home', weights: {}, secondary: null };
}

/** Hazır çalışma alanları. Kimlikler sabittir (varsayılana dönmek için kullanılır). */
export function defaultWorkspaces(): Workspace[] {
  return [
    {
      id: 'general',
      name: 'Genel',
      icon: 'home',
      layout: layout(['home', 'browser'], 'three'),
      widgets: [
        w('g-clock', 'clock', 0, 0, 4, 2),
        w('g-system', 'system', 4, 0, 4, 2),
        w('g-weather', 'weather', 8, 0, 4, 2),
        w('g-favorites', 'favorites', 0, 2, 8, 2),
        w('g-links', 'links', 8, 2, 4, 2),
        w('g-todo', 'todo', 0, 4, 6, 4),
        w('g-notes', 'notes', 6, 4, 6, 4),
        w('g-habits', 'habits', 0, 8, 6, 3),
        w('g-countdown', 'countdown', 6, 8, 6, 3),
      ],
    },
    {
      id: 'work',
      name: 'Çalışma',
      icon: 'briefcase',
      layout: layout(['home', 'browser', 'apps'], 'three'),
      widgets: [
        w('w-clock', 'clock', 0, 0, 6, 2),
        w('w-pomodoro', 'pomodoro', 6, 0, 6, 3),
        w('w-todo', 'todo', 0, 2, 6, 5),
        w('w-system', 'system', 6, 3, 6, 2),
        w('w-notes', 'notes', 6, 5, 6, 4),
        w('w-windows', 'windows', 0, 7, 6, 3),
        w('w-quicknote', 'quicknote', 6, 9, 6, 3),
      ],
    },
    {
      id: 'news-finance',
      name: 'Haberler ve finans',
      icon: 'newspaper',
      layout: layout(['home', 'news'], 'three'),
      widgets: [
        w('n-clock', 'clock', 0, 0, 6, 2),
        w('n-weather', 'weather', 6, 0, 6, 2),
        w('n-calendar', 'calendar', 0, 2, 6, 4),
        w('n-links', 'links', 6, 2, 6, 2),
        w('n-converter', 'converter', 6, 4, 6, 2),
      ],
    },
    {
      id: 'music',
      name: 'Müzik ve eğlence',
      icon: 'music',
      layout: layout(['home', 'music'], 'two'),
      widgets: [
        w('m-clock', 'clock', 0, 0, 6, 2),
        w('m-links', 'links', 6, 0, 6, 2),
        w('m-favorites', 'favorites', 0, 2, 12, 3),
      ],
    },
  ];
}

export function defaultStore(): WorkspaceStore {
  return { activeId: 'general', startup: 'last', items: defaultWorkspaces() };
}

export function sanitizeLayout(raw: unknown, fallback: MainLayout): MainLayout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const preset = r.preset === 'two' || r.preset === 'three' || r.preset === 'focus' ? r.preset : null;
  const docked = Array.isArray(r.docked) ? [...new Set(r.docked.filter(isPanelId))] : fallback.docked;
  const focused = isPanelId(r.focused) ? r.focused : (docked[0] ?? 'home');
  const weights: Partial<Record<PanelId, number>> = {};
  if (r.weights && typeof r.weights === 'object') {
    for (const [k, v] of Object.entries(r.weights as Record<string, unknown>)) {
      if (isPanelId(k) && typeof v === 'number' && Number.isFinite(v)) weights[k] = Math.min(5, Math.max(0.2, v));
    }
  }
  const secondary = isPanelId(r.secondary) && docked.includes(r.secondary) && r.secondary !== focused ? r.secondary : null;
  return { preset, docked, focused, weights, secondary };
}

export function sanitizeWidgets(raw: unknown): WidgetInstance[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const list: WidgetInstance[] = [];
  for (const item of raw.slice(0, 60)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || seen.has(r.id) || !WIDGET_TYPES.includes(r.type as WidgetType)) continue;
    seen.add(r.id);
    const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    list.push({
      id: r.id,
      type: r.type as WidgetType,
      x: n(r.x, 0),
      y: n(r.y, 0),
      w: n(r.w, 4),
      h: n(r.h, 2),
      locked: r.locked === true,
      disabled: r.disabled === true,
      config: r.config && typeof r.config === 'object' && !Array.isArray(r.config) ? (r.config as Record<string, unknown>) : {},
    });
  }
  return normalize(list);
}

export function sanitizeWorkspaces(raw: unknown): WorkspaceStore {
  const defaults = defaultStore();
  const r = (raw && typeof raw === 'object' ? raw : null) as Record<string, unknown> | null;
  if (!r || !Array.isArray(r.items)) return defaults;
  const seen = new Set<string>();
  const items: Workspace[] = [];
  for (const it of r.items.slice(0, 12)) {
    if (!it || typeof it !== 'object') continue;
    const x = it as Record<string, unknown>;
    if (typeof x.id !== 'string' || !x.id || seen.has(x.id)) continue;
    seen.add(x.id);
    const base = defaults.items.find((d) => d.id === x.id);
    items.push({
      id: x.id,
      name: typeof x.name === 'string' && x.name.trim() ? x.name.trim().slice(0, 40) : (base?.name ?? 'Çalışma alanı'),
      icon: ICONS.includes(x.icon as WorkspaceIcon) ? (x.icon as WorkspaceIcon) : (base?.icon ?? 'star'),
      layout: sanitizeLayout(x.layout, base?.layout ?? layout(['home'], null)),
      widgets: sanitizeWidgets(x.widgets),
    });
  }
  if (items.length === 0) return defaults;
  const first = items[0] as Workspace;
  const activeId = typeof r.activeId === 'string' && items.some((i) => i.id === r.activeId) ? r.activeId : first.id;
  const startup =
    typeof r.startup === 'string' && (r.startup === 'last' || items.some((i) => i.id === r.startup)) ? r.startup : 'last';
  return { activeId, startup, items };
}

export function activeWorkspace(store: WorkspaceStore): Workspace {
  return store.items.find((w) => w.id === store.activeId) ?? (store.items[0] as Workspace);
}

export function updateActive(store: WorkspaceStore, f: (w: Workspace) => Workspace): WorkspaceStore {
  return { ...store, items: store.items.map((w) => (w.id === store.activeId ? f(w) : w)) };
}

/** Yeni çalışma alanı: etkin olanın kopyası (düzen + widget'lar, yeni kimliklerle). */
export function createWorkspace(store: WorkspaceStore, name: string): WorkspaceStore {
  const source = activeWorkspace(store);
  const id = `ws-${Date.now().toString(36)}`;
  const copy: Workspace = {
    id,
    name: name.trim().slice(0, 40) || 'Yeni çalışma alanı',
    icon: 'star',
    layout: { ...source.layout, docked: [...source.layout.docked], weights: { ...source.layout.weights }, secondary: source.layout.secondary },
    widgets: source.widgets.map((wi, i) => ({ ...wi, id: `${id}-${i}`, config: { ...wi.config } })),
  };
  return { ...store, activeId: id, items: [...store.items, copy] };
}

export function removeWorkspace(store: WorkspaceStore, id: string): WorkspaceStore {
  if (store.items.length <= 1) return store;
  const items = store.items.filter((w) => w.id !== id);
  const activeId = store.activeId === id ? (items[0] as Workspace).id : store.activeId;
  const startup = store.startup === id ? 'last' : store.startup;
  return { ...store, items, activeId, startup };
}

/** Etkin çalışma alanının düzenini ve widget'larını hazır hâline döndürür (hazır değilse ilk hazırdan). */
export function resetActive(store: WorkspaceStore): WorkspaceStore {
  const defaults = defaultWorkspaces();
  return updateActive(store, (w) => {
    const base = defaults.find((d) => d.id === w.id) ?? (defaults[0] as Workspace);
    return { ...w, layout: base.layout, widgets: base.widgets };
  });
}

export function useWorkspaces() {
  return usePersistentState<WorkspaceStore>(WORKSPACES_KEY, defaultStore(), sanitizeWorkspaces);
}

/** Ayrılmış bir panel penceresinden: paneli etkin çalışma alanının düzenine geri ekler. */
export async function dockIntoActiveWorkspace(panel: PanelId): Promise<void> {
  const store = sanitizeWorkspaces(await readKey<unknown>(WORKSPACES_KEY, null));
  const next = updateActive(store, (w) => ({
    ...w,
    layout: {
      ...w.layout,
      docked: w.layout.docked.includes(panel) ? w.layout.docked : [...w.layout.docked, panel],
      focused: panel,
    },
  }));
  await writeKey(WORKSPACES_KEY, next);
}
