import {
  ArrowLeftRight,
  Command,
  EyeOff,
  ExternalLink,
  LayoutGrid,
  Maximize,
  Minimize,
  PanelRightClose,
  PanelRightOpen,
  Plus,
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
import { PanelVisibleContext } from '../../shared/lib/hooks';
import { setOverlay } from '../../shared/lib/overlay';
import { writeKey } from '../../shared/lib/store';
import { cx, IconButton } from '../../shared/ui/primitives';
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
import { activeWorkspace, updateActive, useWorkspaces, type MainLayout } from '../workspaces/workspaces';
import { Laila } from '../laila/Laila';
import { useAchievementTracker } from '../achievements/useAchievements';
import { MiniPlayer } from '../music/MiniPlayer';
import { WeatherFx } from '../fx/WeatherFx';
import { TickerBar } from '../ticker/TickerBar';
import { FocusChip } from '../focus/FocusChip';
import { useQuickRequests } from '../quick/quickService';
import { dockPanel, promote, setSecondary, swapPanels, togglePanel, undockPanel } from './mainLayout';
import { usePanelDrag, type PanelDragState } from './usePanelDrag';
import { PanelHost } from './PanelHost';
import { PANELS, panelMeta, type PanelId } from './panels';
import { QuickSettings } from './QuickSettings';
import { MiniClock, WorkspaceTabs } from './StatusItems';
import { useWindowChrome } from './useWindowChrome';
import { windowService } from './windowService';

type StageRole = 'primary' | 'secondary' | 'hidden';

/** Ana pencere: üst durum çubuğu + kenar çubuğu + sahne (sekmeler + ana/ikincil görünüm) + alt çubuk. */
export function Shell() {
  const chrome = useWindowChrome();
  const [settings, setSettings] = useSettings();
  const [store, setStore, storeLoaded] = useWorkspaces();
  const toast = useToast();
  useAchievementTracker();
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
  const visibleDocked = useMemo(() => layout.docked.filter((p) => !detached.includes(p)), [layout.docked, detached]);
  const primary: PanelId | undefined = visibleDocked.includes(layout.focused) ? layout.focused : visibleDocked[0];
  const secondary: PanelId | null =
    layout.secondary && layout.secondary !== primary && visibleDocked.includes(layout.secondary) ? layout.secondary : null;
  /** Bağlama sırası sabit (PANELS sırası): sekme sırası/rol değişince DOM düğümleri taşınmaz, yalnız CSS order değişir. */
  const mounted = useMemo(() => PANELS.filter((p) => visibleDocked.includes(p.id)).map((p) => p.id), [visibleDocked]);
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
  useQuickRequests(openPanel);

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

  return (
    <div className={cx('relative isolate flex h-full flex-col', drag && 'cursor-grabbing')}>
      <WeatherFx />
      {drag && <DragGhost drag={drag} />}
      <TitleBar
        title="Alpicim"
        icon={LayoutGrid}
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
              className="glass hidden h-9 items-center gap-2 rounded-xl px-3 text-sm text-muted transition-colors hover:text-fg md:inline-flex"
            >
              <Command size={16} />
              {t('palette.short')}
              <kbd className="text-xs text-faint">Ctrl K</kbd>
            </button>
            <div className="relative">
              <IconButton
                icon={SlidersHorizontal}
                label={t('quick.title')}
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
              onClick={toggleFullscreen}
            />
            {fullscreen && (
              <IconButton icon={EyeOff} label={t('display.hide')} onClick={() => void displayService.hideMain().catch(() => {})} />
            )}
          </>
        }
      >
        <WorkspaceTabs items={store.items} activeId={store.activeId} onSwitch={switchWorkspace} />
        <div className="flex-1" />
        <MiniClock />
        <div className="flex-1" />
      </TitleBar>

      <div className="flex min-h-0 flex-1">
        <div className="relative z-20 shrink-0 py-3 pl-3">
          <nav aria-label={t('shell.nav')} className="glass flex h-full w-16 flex-col items-center gap-1.5 rounded-3xl py-3">
            {PANELS.filter((p) => p.id !== 'settings').map(({ id, titleKey, icon: Icon }) => (
              <SidebarButton
                key={id}
                id={id}
                label={t(titleKey)}
                icon={Icon}
                detached={detached.includes(id)}
                active={id === primary || id === secondary}
                onOpen={openPanel}
              />
            ))}
            <div className="flex-1" />
            {PANELS.filter((p) => p.id === 'settings').map(({ id, titleKey, icon: Icon }) => (
              <SidebarButton
                key={id}
                id={id}
                label={t(titleKey)}
                icon={Icon}
                detached={detached.includes(id)}
                active={id === primary || id === secondary}
                onOpen={openPanel}
              />
            ))}
          </nav>
        </div>
        <main ref={mainRef} className="relative flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3 pl-3">
          <div className="flex min-h-0 flex-1 flex-col gap-3">
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
                      className="group flex w-3 shrink-0 cursor-col-resize items-center justify-center"
                    >
                      <span className="bg-accent-gradient h-8 w-1 rounded-full opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {(settings.barTicker || settings.barPlayer) && (
            <footer aria-label={t('stage.bottomBar')} className="glass flex h-14 shrink-0 items-center gap-3 rounded-2xl px-3">
              {settings.barTicker ? (
                <div className="min-w-0 flex-1">
                  <TickerBar onOpenPanel={openPanel} />
                </div>
              ) : (
                <div className="flex-1" />
              )}
              <FocusChip />
              {settings.barPlayer && (
                <div className="shrink-0">
                  <MiniPlayer onOpenPanel={openPanel} musicTabOpen={visibleDocked.includes('music')} />
                </div>
              )}
            </footer>
          )}
          {settings.lailaEnabled && <Laila hostRef={mainRef} panel={primary} />}
        </main>
      </div>
      {paletteOpen && <CommandPalette commands={paletteCommands} onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

/** Sahnenin sekme şeridi: açık görünümler, sürükleyerek sıralama, sağa sabitleme ve "+" menüsü. */
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
  const closed = PANELS.filter((p) => !tabs.includes(p.id));

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

  return (
    <div className="glass relative z-20 flex max-w-full shrink-0 items-center gap-1 self-start rounded-2xl p-1">
      <div role="tablist" aria-label={t('stage.tabs')} className="flex min-w-0 items-center gap-1 overflow-x-auto">
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
                'group/tab flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl pl-3 pr-2 text-sm transition-colors select-none',
                selected ? 'bg-surface-3 text-fg shadow-[0_0_20px_-8px_var(--accent)]' : 'text-muted hover:bg-surface-2 hover:text-fg',
                pinned && !selected && 'bg-accent-soft text-accent',
                drag?.over === id && drag.panel !== id && 'ring-2 ring-accent',
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
                    className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-surface-3"
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
                  className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-surface-3"
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
                    className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-surface-3"
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
                  className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-surface-3"
                >
                  <X size={14} />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <div ref={menuRef} className="relative shrink-0">
        <IconButton icon={Plus} label={t('stage.addTab')} active={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
        {menuOpen && (
          <div role="menu" className="glass absolute left-0 top-full z-40 mt-2 flex min-w-52 flex-col gap-0.5 rounded-2xl p-1.5">
            {closed.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">{t('stage.allOpen')}</p>
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
                  className="flex h-9 items-center gap-2 rounded-xl px-3 text-left text-sm text-muted hover:bg-surface-3 hover:text-fg"
                >
                  <Icon size={16} strokeWidth={1.75} />
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
      className="glass pointer-events-none fixed z-50 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-accent"
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
        'glass group/panel relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl transition-shadow',
        isTarget && 'ring-2 ring-accent',
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

function SidebarButton({
  id,
  label,
  icon: Icon,
  detached,
  active,
  onOpen,
}: {
  id: PanelId;
  label: string;
  icon: LucideIcon;
  detached: boolean;
  active: boolean;
  onOpen: (p: PanelId) => void;
}) {
  return (
    <button
      type="button"
      title={detached ? `${label} — ${t('shell.inWindow')}` : label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={() => onOpen(id)}
      className={cx(
        'group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all',
        active ? 'bg-accent-soft text-accent shadow-[0_0_24px_-6px_var(--accent)]' : 'text-muted hover:bg-surface-3 hover:text-fg',
      )}
    >
      <Icon size={20} strokeWidth={1.75} />
      {detached && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />}
      <span
        aria-hidden
        className="glass pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 rounded-lg px-2.5 py-1 text-sm whitespace-nowrap text-fg opacity-0 transition-opacity group-hover:opacity-100"
      >
        {label}
      </span>
    </button>
  );
}

function EmptyLayout({ onOpen }: { onOpen: (p: PanelId) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-base font-medium">{t('shell.emptyTitle')}</p>
      <p className="max-w-sm text-sm text-muted">{t('shell.emptyBody')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {PANELS.map(({ id, titleKey, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onOpen(id)}
            className="flex h-9 items-center gap-2 rounded-lg bg-surface-2 px-3.5 text-sm hover:bg-surface-3"
          >
            <Icon size={16} />
            {t(titleKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

