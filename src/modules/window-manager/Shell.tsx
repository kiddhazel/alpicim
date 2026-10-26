import {
  ArrowLeftRight,
  EyeOff,
  ExternalLink,
  LayoutDashboard,
  Maximize,
  Minimize,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { t } from '../../i18n';
import { MODULES } from '../../core/modules';
import { ModuleServices } from '../../core/modules/ModuleServices';
import { groupByCategory, moduleOfPanel } from '../../core/modules/registry';
import type { ModuleCategory } from '../../core/modules/types';
import { useEnabledPanels, useModuleEnabled } from '../../core/modules/useModules';
import { PanelVisibleContext } from '../../shared/lib/hooks';
import { setOverlay } from '../../shared/lib/overlay';
import { writeKey } from '../../shared/lib/store';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { Tooltip } from '../../shared/ui/overlays';
import { Button, cx, EmptyState, IconButton } from '../../shared/ui/primitives';
import { TitleBar } from '../../shared/ui/TitleBar';
import { useToast } from '../../shared/ui/Toast';
import { describeError } from '../../shared/ui/StateView';
import { BROWSER_KEYS } from '../browser/browserService';
import { displayService, PALETTE_EVENT, subscribe, useDisplay } from '../display/displayService';
import { CommandPalette, type PaletteCommands } from '../palette/CommandPalette';
import { useSettings } from '../settings/settings';
import { findSpot } from '../widgets/grid';
import { widgetDef } from '../widgets/registry';
import type { WidgetType } from '../widgets/types';
import { activeWorkspace, updateActive, useWorkspaces, type MainLayout, type Workspace } from '../workspaces/workspaces';
import { MiniPlayer } from '../music/MiniPlayer';
import { TickerBar } from '../ticker/TickerBar';
import { FocusChip } from '../focus/FocusChip';
import { HolidayMark } from '../fx/HolidayMark';
import { dockPanel, promote, setSecondary, swapPanels, togglePanel, undockPanel } from './mainLayout';
import { usePanelDrag, type PanelDragState } from './usePanelDrag';
import { PanelHost } from './PanelHost';
import { panelMeta, type PanelId, type PanelMeta } from './panels';
import { QuickSettings } from './QuickSettings';
import { MiniClock, WorkspaceSwitcher } from './StatusItems';
import { useWindowChrome } from './useWindowChrome';
import { windowService } from './windowService';

type StageRole = 'primary' | 'secondary' | 'hidden';

/** Ana pencere: üst durum çubuğu + kenar çubuğu + sahne (sekmeler + ana/ikincil görünüm) + alt çubuk. */
export function Shell() {
  const chrome = useWindowChrome();
  const [settings, setSettings] = useSettings();
  const [store, setStore, storeLoaded] = useWorkspaces();
  const toast = useToast();
  const { snapshot: display, setSnapshot: setDisplay } = useDisplay();
  const [quickOpen, setQuickOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const startupApplied = useRef(false);

  const ws = activeWorkspace(store);
  const layout = ws.layout;
  const setLayout = useCallback(
    (f: (l: MainLayout) => MainLayout) => setStore((s) => updateActive(s, (w) => ({ ...w, layout: f(w.layout) }))),
    [setStore],
  );

  const { drag, startDrag } = usePanelDrag((from, to) => setLayout((l) => swapPanels(l, from, to)));

  // Açılış çalışma alanı.
  useEffect(() => {
    if (!storeLoaded || startupApplied.current) return;
    startupApplied.current = true;
    if (store.startup !== 'last' && store.startup !== store.activeId) setStore((s) => ({ ...s, activeId: s.startup }));
  }, [storeLoaded, store.startup, store.activeId, setStore]);

  const detached = chrome.layout.detached;
  const panelList = useEnabledPanels();
  const focusEnabled = useModuleEnabled('focus');
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>('shell.sidebarCollapsed', false, (raw) => raw === true);
  const navGroups = useMemo<NavGroup[]>(() => {
    const nav = panelList.filter((p) => p.id !== 'settings');
    const cat = (p: PanelMeta): ModuleCategory => moduleOfPanel(MODULES, p.id)?.category ?? 'core';
    return groupByCategory(MODULES)
      .map(({ category }) => ({ category, panels: nav.filter((p) => cat(p) === category) }))
      .filter((g) => g.panels.length > 0);
  }, [panelList]);
  const settingsPanel = panelList.find((p) => p.id === 'settings');
  const enabledPanelIds = useMemo(() => new Set<PanelId>(panelList.map((p) => p.id)), [panelList]);
  const visibleDocked = useMemo(
    () => layout.docked.filter((p) => !detached.includes(p) && enabledPanelIds.has(p)),
    [layout.docked, detached, enabledPanelIds],
  );
  const primary: PanelId | undefined = visibleDocked.includes(layout.focused) ? layout.focused : visibleDocked[0];
  const secondary: PanelId | null =
    layout.secondary && layout.secondary !== primary && visibleDocked.includes(layout.secondary) ? layout.secondary : null;
  /** Bağlama sırası sabit (panel listesi sırası): sekme sırası/rol değişince DOM düğümleri taşınmaz, yalnız CSS order değişir. */
  const mounted = useMemo(() => panelList.filter((p) => visibleDocked.includes(p.id)).map((p) => p.id), [panelList, visibleDocked]);
  const fullscreen = display.fullscreen;
  const stageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [live, setLive] = useState<Partial<Record<PanelId, number>> | null>(null);

  // Ayarlardaki tepsi tercihlerini Rust tarafına bildir.
  useEffect(() => {
    windowService.setCloseToTray(settings.closeToTray).catch(() => {});
  }, [settings.closeToTray]);
  useEffect(() => {
    displayService.setStartHidden(settings.startHidden).catch(() => {});
  }, [settings.startHidden]);

  const openPanel = useCallback(
    (panel: PanelId) => {
      if (detached.includes(panel)) {
        // Ayrı pencerede açık: o pencereyi öne getir.
        windowService.openPanelWindow(panel).catch(() => {});
        return;
      }
      setLayout((l) => dockPanel(l, panel));
    },
    [detached, setLayout],
  );

  const detach = useCallback(
    async (panel: PanelId) => {
      try {
        await windowService.openPanelWindow(panel);
        setLayout((l) => undockPanel(l, panel));
      } catch (err) {
        toast.push('error', describeError(err).title);
      }
    },
    [setLayout, toast],
  );

  const toggleFullscreen = useCallback(() => {
    displayService.toggleFullscreen().catch((err: unknown) => toast.push('error', describeError(err).description));
  }, [toast]);

  const switchWorkspace = useCallback((id: string) => setStore((s) => ({ ...s, activeId: id })), [setStore]);

  const addWidget = useCallback(
    (type: WidgetType) => {
      const def = widgetDef(type);
      setStore((s) =>
        updateActive(s, (w) => {
          const spot = findSpot(w.widgets, def.defaultSize.w, def.defaultSize.h);
          const item = { id: `${type}-${Date.now().toString(36)}`, type, ...spot, ...def.defaultSize, config: { ...def.defaults } };
          return { ...w, widgets: [...w.widgets, item], layout: dockPanel(w.layout, 'home') };
        }),
      );
    },
    [setStore],
  );

  /** Sekme şeridi: sonraki/önceki sekmeyi öne alır. */
  const cycleTab = useCallback(
    (step: 1 | -1) => {
      if (visibleDocked.length < 2 || !primary) return;
      const i = visibleDocked.indexOf(primary);
      const next = visibleDocked[(i + step + visibleDocked.length) % visibleDocked.length];
      if (next) setLayout((l) => promote(l, next));
    },
    [visibleDocked, primary, setLayout],
  );
  /** Geçerli ana sekmeyi kapatır; son sekme kapatılmaz. */
  const closeCurrentTab = useCallback(() => {
    if (visibleDocked.length < 2 || !primary) return;
    setLayout((l) => undockPanel(l, primary));
  }, [visibleDocked, primary, setLayout]);
  const toggleSplit = useCallback(() => {
    setLayout((l) => {
      if (secondary !== null) return setSecondary(l, null);
      const next = visibleDocked.find((p) => p !== primary);
      return setSecondary(l, next ?? null);
    });
  }, [secondary, visibleDocked, primary, setLayout]);
  const [addMenuSignal, setAddMenuSignal] = useState(0);

  // Klavye: Ctrl+K komut paleti, F11 tam ekran, Ctrl+1…9 çalışma alanı, Ctrl+Tab/W/T/\ sahne sekmeleri.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      const typing = !!el && (el.matches('input, textarea, select') || el.isContentEditable);
      const ctrl = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (ctrl && !typing && e.key === 'Tab') {
        e.preventDefault();
        cycleTab(e.shiftKey ? -1 : 1);
      } else if (ctrl && !typing && !e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        closeCurrentTab();
      } else if (ctrl && !typing && !e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setAddMenuSignal((n) => n + 1);
      } else if (ctrl && !typing && !e.shiftKey && e.key === '\\') {
        e.preventDefault();
        if (secondary !== null || visibleDocked.length > 1) toggleSplit();
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.ctrlKey && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        const target = store.items[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          switchWorkspace(target.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen, switchWorkspace, store.items, cycleTab, closeCurrentTab, toggleSplit, secondary, visibleDocked.length]);
  // Sistem çapındaki palet kısayolu (Rust → olay).
  useEffect(() => subscribe<null>(PALETTE_EVENT, () => setPaletteOpen(true)), []);

  const paletteCommands = useMemo<PaletteCommands>(
    () => ({
      workspaces: store.items,
      activeWorkspaceId: store.activeId,
      docked: layout.docked,
      openPanel,
      togglePanel: (p) => setLayout((l) => togglePanel(l, p)),
      switchWorkspace,
      addWidget,
      openUrlInBrowser: (url) => {
        void writeKey(BROWSER_KEYS.lastUrl, url);
        void writeKey(BROWSER_KEYS.request, { url, at: Date.now() });
        openPanel('browser');
      },
      toggleFullscreen,
      hideApp: () => void displayService.hideMain().catch(() => {}),
      togglePerformance: () => setSettings((s) => ({ ...s, performanceMode: !s.performanceMode })),
      nextTab: () => cycleTab(1),
      closeTab: closeCurrentTab,
      toggleSplit: () => {
        if (secondary !== null || visibleDocked.length > 1) toggleSplit();
      },
    }),
    [
      store.items,
      store.activeId,
      layout.docked,
      openPanel,
      setLayout,
      switchWorkspace,
      addWidget,
      toggleFullscreen,
      setSettings,
      cycleTab,
      closeCurrentTab,
      toggleSplit,
      secondary,
      visibleDocked.length,
    ],
  );

  const weightOf = (id: PanelId) => live?.[id] ?? layout.weights[id] ?? 1;
  const setWeights = (w: Partial<Record<PanelId, number>>) => setLayout((l) => ({ ...l, weights: { ...l.weights, ...w } }));
  const closeTab = (p: PanelId) => setLayout((l) => undockPanel(l, p));
  const pinRight = (p: PanelId) => setLayout((l) => setSecondary(l, l.secondary === p ? null : p));
  const makePrimary = (p: PanelId) => setLayout((l) => ({ ...promote(l, p), secondary: l.secondary === p ? (primary ?? null) : l.secondary }));

  /** Ayırıcıyı sürükleyerek ana/ikincil genişlik oranını değiştirir; sürükleme sırasında yerel yüzeyler gizlenir. */
  const startResize = (left: PanelId, right: PanelId, e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const leftEl = stageRef.current?.querySelector<HTMLElement>('[data-stage-role="primary"]');
    const rightEl = stageRef.current?.querySelector<HTMLElement>('[data-stage-role="secondary"]');
    if (!leftEl || !rightEl) return;
    const startX = e.clientX;
    const wl = leftEl.getBoundingClientRect().width;
    const wr = rightEl.getBoundingClientRect().width;
    const sum = weightOf(left) + weightOf(right);
    const total = wl + wr;
    let latest: Partial<Record<PanelId, number>> = {};
    setOverlay('panel-resize', true);
    const move = (ev: PointerEvent) => {
      const nl = Math.min(total - 260, Math.max(260, wl + ev.clientX - startX));
      latest = { [left]: (sum * nl) / total, [right]: (sum * (total - nl)) / total };
      setLive(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setOverlay('panel-resize', false);
      setLive(null);
      if (Object.keys(latest).length > 0) setWeights(latest);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const pageTitle = primary ? t(panelMeta(primary).titleKey) : 'Alpicim';

  return (
    <div className={cx('relative isolate flex h-full', drag && 'cursor-grabbing')}>
      <ModuleServices host="shell-background" />
      <ModuleServices host="shell-logic" openPanel={openPanel} />
      {drag && <DragGhost drag={drag} />}
      <Sidebar
        collapsed={sidebarCollapsed}
        windowed={!fullscreen}
        groups={navGroups}
        settingsPanel={settingsPanel}
        detached={detached}
        primary={primary}
        secondary={secondary}
        onOpen={openPanel}
        workspaces={store.items}
        activeWorkspaceId={store.activeId}
        onSwitchWorkspace={switchWorkspace}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar
          title={pageTitle}
          leading={
            <IconButton
              icon={sidebarCollapsed ? PanelLeftOpen : PanelLeftClose}
              label={sidebarCollapsed ? t('shell.sidebarExpand') : t('shell.sidebarCollapse')}
              size="sm"
              onClick={() => setSidebarCollapsed((c) => !c)}
            />
          }
          windowed={!fullscreen}
          pinned={chrome.pinned}
          maximized={chrome.maximized}
          onTogglePin={chrome.togglePin}
          onMinimize={() => void windowService.minimize()}
          onToggleMaximize={() => void windowService.toggleMaximize()}
          onClose={() => void windowService.closeCurrent()}
          closeLabel={settings.closeToTray ? t('window.closeToTray') : t('window.close')}
          trailing={
            <>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                title={t('palette.title')}
                className="hidden h-8 w-56 items-center gap-2 rounded-lg bg-control px-2.5 text-sm text-fg-3 shadow-[inset_0_0_0_1px_var(--stroke)] transition-colors duration-150 hover:bg-control-hover md:flex"
              >
                <Search size={14} strokeWidth={1.75} />
                <span className="flex-1 truncate text-left">{t('shell.searchPlaceholder')}</span>
                <kbd className="rounded bg-control px-1.5 text-xs text-fg-2">Ctrl K</kbd>
              </button>
              <IconButton icon={Search} label={t('palette.title')} size="sm" className="md:hidden" onClick={() => setPaletteOpen(true)} />
              <div className="relative">
                <IconButton
                  icon={SlidersHorizontal}
                  label={t('quick.title')}
                  size="sm"
                  active={quickOpen}
                  data-quick-settings-toggle
                  onClick={() => setQuickOpen((o) => !o)}
                />
                {quickOpen && (
                  <QuickSettings
                    display={display}
                    onDisplay={setDisplay}
                    docked={layout.docked}
                    onTogglePanel={(p) => setLayout((l) => togglePanel(l, p))}
                    onOpenSettings={() => openPanel('settings')}
                    onClose={() => setQuickOpen(false)}
                    split={secondary !== null}
                    canSplit={visibleDocked.length > 1}
                    onToggleSplit={(on) =>
                      setLayout((l) => {
                        if (!on) return setSecondary(l, null);
                        const next = visibleDocked.find((p) => p !== primary);
                        return setSecondary(l, next ?? null);
                      })
                    }
                  />
                )}
              </div>
              <IconButton
                icon={fullscreen ? Minimize : Maximize}
                label={fullscreen ? t('display.exitFullscreen') : t('display.enterFullscreen')}
                size="sm"
                onClick={toggleFullscreen}
              />
              {fullscreen && (
                <IconButton icon={EyeOff} size="sm" label={t('display.hide')} onClick={() => void displayService.hideMain().catch(() => {})} />
              )}
            </>
          }
        />

        <main ref={mainRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 pb-3">
          {!storeLoaded ? null : visibleDocked.length === 0 ? (
            <EmptyLayout onOpen={openPanel} />
          ) : (
            <>
              <TabStrip
                tabs={visibleDocked}
                primary={primary}
                secondary={secondary}
                drag={drag}
                onDragStart={startDrag}
                onSelect={(p) => setLayout((l) => promote(l, p))}
                onClose={closeTab}
                onPinRight={pinRight}
                onDetach={detach}
                onMakePrimary={makePrimary}
                onOpen={openPanel}
                openMenuSignal={addMenuSignal}
              />
              {/* Tüm açık paneller tek sabit listede bağlı kalır; roller yalnızca CSS ile değişir. */}
              <div ref={stageRef} className="flex min-h-0 flex-1">
                {mounted.map((id) => {
                  const role: StageRole = id === primary ? 'primary' : id === secondary ? 'secondary' : 'hidden';
                  const split = secondary !== null;
                  return (
                    <div
                      key={id}
                      data-stage-role={role}
                      className={cx('min-w-0', role === 'hidden' ? 'hidden' : 'flex')}
                      style={
                        role === 'primary'
                          ? { order: 0, flex: split ? `${weightOf(id)} 1 0` : '1 1 0' }
                          : role === 'secondary'
                            ? { order: 2, flex: `${weightOf(id)} 1 0` }
                            : undefined
                      }
                    >
                      <PanelVisibleContext.Provider value={role !== 'hidden'}>
                        <PanelFrame panel={id} onOpenPanel={openPanel} drag={drag} />
                      </PanelVisibleContext.Provider>
                    </div>
                  );
                })}
                {primary && secondary && (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t('shell.resizePanels')}
                    title={t('shell.resizePanels')}
                    style={{ order: 1 }}
                    onPointerDown={(e) => startResize(primary, secondary, e)}
                    onDoubleClick={() => setWeights({ [primary]: 1, [secondary]: 1 })}
                    className="group flex w-3 shrink-0 cursor-col-resize justify-center"
                  >
                    <span className="h-full w-px bg-stroke transition-colors group-hover:bg-accent" />
                  </div>
                )}
              </div>
            </>
          )}
          <ModuleServices host="shell-overlay" hostRef={mainRef} panel={primary} />
        </main>

        <footer
          aria-label={t('stage.bottomBar')}
          className="flex h-8 shrink-0 items-center gap-4 border-t border-stroke bg-layer px-4 text-xs text-fg-2"
        >
          {settings.barTicker ? (
            <div className="min-w-0 flex-1">
              <TickerBar onOpenPanel={openPanel} />
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <HolidayMark iconOnly />
          {focusEnabled && <FocusChip />}
          {settings.barPlayer && (
            <div className="shrink-0">
              <MiniPlayer onOpenPanel={openPanel} musicTabOpen={visibleDocked.includes('music')} />
            </div>
          )}
          <MiniClock />
        </footer>
      </div>
      {paletteOpen && <CommandPalette commands={paletteCommands} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

const POP = 'bg-card shadow-[inset_0_0_0_1px_var(--stroke-strong),var(--shadow-pop)]';

interface NavGroup {
  category: ModuleCategory;
  panels: PanelMeta[];
}

/** Sol kenar çubuğu: uygulama adı, çalışma alanı seçici, kategoriye göre gruplu panel listesi, altta Ayarlar. */
function Sidebar({
  collapsed,
  windowed,
  groups,
  settingsPanel,
  detached,
  primary,
  secondary,
  onOpen,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
}: {
  collapsed: boolean;
  windowed: boolean;
  groups: NavGroup[];
  settingsPanel: PanelMeta | undefined;
  detached: PanelId[];
  primary: PanelId | undefined;
  secondary: PanelId | null;
  onOpen: (p: PanelId) => void;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSwitchWorkspace: (id: string) => void;
}) {
  const drag = windowed ? { 'data-tauri-drag-region': true } : {};
  const item = (p: PanelMeta) => (
    <NavItem
      key={p.id}
      id={p.id}
      label={t(p.titleKey)}
      icon={p.icon}
      collapsed={collapsed}
      detached={detached.includes(p.id)}
      active={p.id === primary || p.id === secondary}
      onOpen={onOpen}
    />
  );
  return (
    <aside
      style={{ width: collapsed ? 56 : 232 }}
      className="relative z-20 flex shrink-0 flex-col border-r border-stroke bg-layer transition-[width] duration-150 ease-[cubic-bezier(.2,0,0,1)]"
    >
      <div {...drag} className={cx('flex h-12 shrink-0 items-center gap-2.5', collapsed ? 'justify-center' : 'px-4')}>
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent font-display text-sm font-semibold text-on-accent">A</span>
        {!collapsed && <span className="font-display text-base font-semibold">Alpicim</span>}
      </div>
      <div className="flex flex-col px-2 pb-2">
        <WorkspaceSwitcher items={workspaces} activeId={activeWorkspaceId} onSwitch={onSwitchWorkspace} collapsed={collapsed} />
      </div>
      <nav aria-label={t('shell.nav')} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">
        {groups.map((g, gi) => (
          <div key={g.category} className="flex flex-col gap-0.5">
            {g.category !== 'core' && !collapsed && <p className="px-3 pb-1 text-xs font-semibold text-fg-3">{t(`modules.categories.${g.category}`)}</p>}
            {g.category !== 'core' && collapsed && gi > 0 && <div className="mx-3 mb-1 h-px bg-stroke" />}
            {g.panels.map(item)}
          </div>
        ))}
      </nav>
      {settingsPanel && <div className="border-t border-stroke px-2 py-2">{item(settingsPanel)}</div>}
    </aside>
  );
}

function NavItem({
  id,
  label,
  icon: Icon,
  collapsed,
  detached,
  active,
  onOpen,
}: {
  id: PanelId;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  detached: boolean;
  active: boolean;
  onOpen: (p: PanelId) => void;
}) {
  const full = detached ? `${label} — ${t('shell.inWindow')}` : label;
  const btn = (
    <button
      type="button"
      onClick={() => onOpen(id)}
      aria-label={full}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'relative flex h-9 items-center gap-3 rounded-lg text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent',
        collapsed ? 'w-10 justify-center self-center' : 'w-full px-3',
        active ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-2 hover:bg-card-hover hover:text-fg',
      )}
    >
      {active && !collapsed && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
      <Icon size={20} strokeWidth={1.75} className={cx('shrink-0', active && 'text-accent')} />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {detached && <span aria-hidden className={cx('h-1.5 w-1.5 shrink-0 rounded-full bg-accent', collapsed && 'absolute right-1.5 top-1.5')} />}
    </button>
  );
  return collapsed ? (
    <Tooltip text={full} side="bottom">
      {btn}
    </Tooltip>
  ) : (
    btn
  );
}

/** Sahnenin sekme satırı (en az iki panel açıkken): sürükleyerek sıralama, sağa sabitleme, ayırma ve "+" menüsü. */
function TabStrip({
  tabs,
  primary,
  secondary,
  drag,
  onDragStart,
  onSelect,
  onClose,
  onPinRight,
  onDetach,
  onMakePrimary,
  onOpen,
  openMenuSignal,
}: {
  onDetach: (p: PanelId) => void;
  onMakePrimary: (p: PanelId) => void;
  openMenuSignal: number;
  tabs: PanelId[];
  primary: PanelId | undefined;
  secondary: PanelId | null;
  drag: PanelDragState | null;
  onDragStart: (p: PanelId, e: ReactPointerEvent) => void;
  onSelect: (p: PanelId) => void;
  onClose: (p: PanelId) => void;
  onPinRight: (p: PanelId) => void;
  onOpen: (p: PanelId) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closed = useEnabledPanels().filter((p) => !tabs.includes(p.id));

  // Ctrl+T: "+" menüsünü aç.
  useEffect(() => {
    if (openMenuSignal > 0) setMenuOpen(true);
  }, [openMenuSignal]);

  useEffect(() => {
    if (!menuOpen) return;
    setOverlay('stage-add-menu', true);
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    // pointerdown + yakalama: sürükleme başlıkları preventDefault çağırınca mousedown oluşmuyor.
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      setOverlay('stage-add-menu', false);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (tabs.length < 2) return null;

  const mini = 'flex h-6 w-6 items-center justify-center rounded-md hover:bg-control-hover';
  return (
    <div className="relative z-20 mb-3 flex shrink-0 items-end gap-1 border-b border-stroke">
      <div role="tablist" aria-label={t('stage.tabs')} className="flex min-w-0 items-end gap-1 overflow-x-auto">
        {tabs.map((id) => {
          const meta = panelMeta(id);
          const Icon = meta.icon;
          const selected = id === primary;
          const pinned = id === secondary;
          const act = () => onSelect(id);
          return (
            <div
              key={id}
              role="tab"
              tabIndex={0}
              aria-selected={selected}
              data-panel-drop={id}
              title={t('shell.dragHint')}
              onPointerDown={(e) => onDragStart(id, e)}
              onClick={act}
              onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && act()}
              className={cx(
                'group/tab relative flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-t-lg pl-3 pr-2 text-sm transition-colors duration-150 select-none',
                selected ? 'font-semibold text-fg' : pinned ? 'text-accent' : 'text-fg-2 hover:text-fg',
                drag?.over === id && drag.panel !== id && 'bg-accent-soft',
                drag?.panel === id && 'opacity-50',
              )}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span className="max-w-32 truncate">{t(meta.titleKey)}</span>
              <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/tab:opacity-100 group-focus-within/tab:opacity-100">
                {pinned && (
                  <button
                    type="button"
                    title={t('stage.makePrimary')}
                    aria-label={t('stage.makePrimary')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMakePrimary(id);
                    }}
                    className={mini}
                  >
                    <ArrowLeftRight size={14} />
                  </button>
                )}
                <button
                  type="button"
                  title={t('shell.detach')}
                  aria-label={t('shell.detach')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDetach(id);
                  }}
                  className={mini}
                >
                  <ExternalLink size={14} />
                </button>
                {!selected && (
                  <button
                    type="button"
                    title={pinned ? t('stage.unpin') : t('stage.pinRight')}
                    aria-label={pinned ? t('stage.unpin') : t('stage.pinRight')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinRight(id);
                    }}
                    className={mini}
                  >
                    {pinned ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                  </button>
                )}
                <button
                  type="button"
                  title={t('stage.closeTab')}
                  aria-label={t('stage.closeTab')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(id);
                  }}
                  className={mini}
                >
                  <X size={14} />
                </button>
              </span>
              {selected && <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
            </div>
          );
        })}
      </div>
      <div ref={menuRef} className="relative mb-0.5 shrink-0">
        <IconButton icon={Plus} size="sm" label={t('stage.addTab')} active={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
        {menuOpen && (
          <div role="menu" className={cx('absolute left-0 top-full z-40 mt-1 flex min-w-52 flex-col gap-0.5 rounded-xl p-1', POP)}>
            {closed.length === 0 ? (
              <p className="px-2.5 py-2 text-sm text-fg-2">{t('stage.allOpen')}</p>
            ) : (
              closed.map(({ id, titleKey, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen(id);
                  }}
                  className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-fg outline-none transition-colors hover:bg-control-hover focus:bg-control-hover"
                >
                  <Icon size={16} strokeWidth={1.75} className="text-fg-2" />
                  {t(titleKey)}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DragGhost({ drag }: { drag: PanelDragState }) {
  const meta = panelMeta(drag.panel);
  const Icon = meta.icon;
  return (
    <div
      className={cx('pointer-events-none fixed z-50 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold', POP)}
      style={{ left: drag.x + 12, top: drag.y + 12 }}
    >
      <Icon size={16} className="text-accent" />
      {t(meta.titleKey)}
    </div>
  );
}

/** Bellekte tutulur: ayırıcı sürüklenirken (her pointermove'da Shell yeniden çizilir) panel içerikleri yeniden çizilmez. */
const PanelFrame = memo(function PanelFrame({
  panel,
  onOpenPanel,
  drag,
}: {
  panel: PanelId;
  onOpenPanel: (p: PanelId) => void;
  drag: PanelDragState | null;
}) {
  const meta = panelMeta(panel);
  const isTarget = drag !== null && drag.over === panel && drag.panel !== panel;
  const isSource = drag?.panel === panel;
  return (
    <section
      aria-label={t(meta.titleKey)}
      data-panel-drop={panel}
      className={cx(
        'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl',
        isTarget && 'shadow-[inset_0_0_0_2px_var(--accent)]',
        isSource && 'opacity-50',
      )}
    >
      {isTarget && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-accent-soft text-sm font-semibold text-accent">
          {t('shell.dropHere')}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <PanelHost panel={panel} onOpenPanel={onOpenPanel} />
      </div>
    </section>
  );
});

function EmptyLayout({ onOpen }: { onOpen: (p: PanelId) => void }) {
  const panelList = useEnabledPanels();
  return (
    <EmptyState
      icon={LayoutDashboard}
      title={t('shell.emptyTitle')}
      description={t('shell.emptyBody')}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {panelList.map(({ id, titleKey, icon }) => (
            <Button key={id} icon={icon} onClick={() => onOpen(id)}>
              {t(titleKey)}
            </Button>
          ))}
        </div>
      }
    />
  );
}
