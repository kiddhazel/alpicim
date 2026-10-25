import { Check, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { t } from '../../i18n';
import { useActiveView } from '../../shared/lib/hooks';
import { writeKey } from '../../shared/lib/store';
import { BROWSER_KEYS } from '../browser/browserService';
import { Button, cx } from '../../shared/ui/primitives';
import { StateView } from '../../shared/ui/StateView';
import { useSettings } from '../settings/settings';
import type { PanelId } from '../window-manager/panels';
import { activeWorkspace, defaultWorkspaces, updateActive, useWorkspaces } from '../workspaces/workspaces';
import { AddWidgetDialog } from './AddWidgetDialog';
import { findSpot, GRID_COLS, gridHeight, moveItem, resizeItem } from './grid';
import { widgetDef } from './registry';
import type { WidgetInstance, WidgetType } from './types';
import { HomeHero } from './HomeHero';
import { WidgetFrame } from './WidgetFrame';
import { WidgetHostContext } from './WidgetHost';

const ROW = 88;
const GAP = 12;
/** Bu genişliğin altında widget'lar tek sütunda alt alta gösterilir (düzenleme kapalı). */
const STACK_BELOW = 520;

interface DragState {
  id: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  orig: WidgetInstance;
}

/** Ana ekran: etkin çalışma alanının widget ızgarası. */
export function WidgetBoard({ onOpenPanel }: { onOpenPanel: (p: PanelId) => void }) {
  const [store, setStore, loaded] = useWorkspaces();
  const [settings] = useSettings();
  const ws = activeWorkspace(store);
  const widgets = ws.widgets;
  // Pencere gizliyken veya ana ekran etkin olmayan bir sekmedeyken widget'lar yenileme yapmaz.
  const pageVisible = useActiveView();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [draft, setDraft] = useState<WidgetInstance[] | null>(null);
  const [width, setWidth] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const draftRef = useRef<WidgetInstance[] | null>(null);
  draftRef.current = draft;

  const setWidgets = useCallback(
    (f: (list: WidgetInstance[]) => WidgetInstance[]) => setStore((s) => updateActive(s, (w) => ({ ...w, widgets: f(w.widgets) }))),
    [setStore],
  );

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [loaded]);

  // Çalışma alanı değişince düzenleme taslağını bırak.
  useEffect(() => {
    setDraft(null);
    setConfirmReset(false);
  }, [ws.id]);

  const stacked = width > 0 && width < STACK_BELOW;
  const colW = (width - GAP * (GRID_COLS - 1)) / GRID_COLS;
  const shown = draft ?? widgets;

  const onConfig = useCallback(
    (id: string, patch: Record<string, unknown>) =>
      setWidgets((list) => list.map((w) => (w.id === id ? { ...w, config: { ...w.config, ...patch } } : w))),
    [setWidgets],
  );
  const onPatch = useCallback(
    (id: string, patch: Partial<WidgetInstance>) => setWidgets((list) => list.map((w) => (w.id === id ? { ...w, ...patch } : w))),
    [setWidgets],
  );
  const onRemove = useCallback((id: string) => setWidgets((list) => list.filter((w) => w.id !== id)), [setWidgets]);

  const add = (type: WidgetType) => {
    const def = widgetDef(type);
    setWidgets((list) => {
      const spot = findSpot(list, def.defaultSize.w, def.defaultSize.h);
      const item: WidgetInstance = {
        id: `${type}-${Date.now().toString(36)}`,
        type,
        ...spot,
        ...def.defaultSize,
        config: { ...def.defaults },
      };
      return [...list, item];
    });
    setAdding(false);
  };

  const onDragStart = useCallback(
    (id: string, mode: 'move' | 'resize', e: ReactPointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
      const orig = widgets.find((w) => w.id === id);
      if (!orig) return;
      e.preventDefault();
      drag.current = { id, mode, startX: e.clientX, startY: e.clientY, orig };
      setDraft(widgets);
    },
    [widgets],
  );

  useEffect(() => {
    if (!draft) return;
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dCol = Math.round((e.clientX - d.startX) / (colW + GAP));
      const dRow = Math.round((e.clientY - d.startY) / (ROW + GAP));
      setDraft(
        d.mode === 'move'
          ? moveItem(widgets, d.id, d.orig.x + dCol, d.orig.y + dRow)
          : resizeItem(widgets, d.id, d.orig.w + dCol, d.orig.h + dRow, widgetDef(d.orig.type).limits),
      );
    };
    const up = () => {
      const result = draftRef.current;
      drag.current = null;
      setDraft(null);
      if (result) setWidgets(() => result);
    };
    const cancel = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        drag.current = null;
        setDraft(null);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', cancel);
    };
  }, [draft !== null, colW, widgets, setWidgets]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setStore((s) => {
      const base = defaultWorkspaces().find((d) => d.id === s.activeId) ?? defaultWorkspaces()[0];
      return updateActive(s, (w) => ({ ...w, widgets: base?.widgets ?? [] }));
    });
    setConfirmReset(false);
  };

  const host = useMemo(
    () => ({
      openPanel: onOpenPanel,
      openUrl: (url: string) => {
        void writeKey(BROWSER_KEYS.lastUrl, url);
        void writeKey(BROWSER_KEYS.request, { url, at: Date.now() });
        onOpenPanel('browser');
      },
    }),
    [onOpenPanel],
  );
  const animate = !settings.performanceMode && !draft;
  const sorted = useMemo(() => [...shown].sort((a, b) => a.y - b.y || a.x - b.x), [shown]);

  return (
    <WidgetHostContext.Provider value={host}>
      <div className="h-full overflow-y-auto">
        <HomeHero widgets={widgets} performanceMode={settings.performanceMode} active={pageVisible} />
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-end gap-2 px-6 pb-3">
          <p className="min-w-0 flex-1 truncate text-right text-sm text-faint">
            {editing ? t('widgets.editHint') : t('widgets.workspaceLabel', { name: ws.name, n: widgets.length })}
          </p>
          {editing && (
            <>
              {confirmReset ? (
                <>
                  <span className="text-sm text-warn">{t('widgets.resetConfirm')}</span>
                  <Button variant="danger" onClick={reset}>
                    {t('common.yes')}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                    {t('common.cancel')}
                  </Button>
                </>
              ) : (
                <Button variant="ghost" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
                  {t('widgets.reset')}
                </Button>
              )}
            </>
          )}
          <Button icon={Plus} onClick={() => setAdding(true)}>
            {t('widgets.add')}
          </Button>
          <Button variant={editing ? 'primary' : 'secondary'} icon={editing ? Check : Pencil} onClick={() => setEditing((e) => !e)} disabled={stacked}>
            {editing ? t('widgets.done') : t('widgets.edit')}
          </Button>
        </div>

        <div className="mx-auto w-full max-w-[1600px] px-6 pb-6">
        <div ref={boardRef}>
          {!loaded ? null : widgets.length === 0 ? (
            <StateView
              kind="empty"
              title={t('widgets.emptyTitle')}
              description={t('widgets.emptyBody')}
              action={
                <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                  {t('widgets.add')}
                </Button>
              }
            />
          ) : stacked ? (
            <div className="flex flex-col gap-3">
              {sorted.map((w) => (
                <div key={w.id} className="relative" style={{ height: w.h * ROW + (w.h - 1) * GAP }}>
                  <WidgetFrame
                    widget={w}
                    style={{ inset: 0 }}
                    editing={false}
                    dragging={false}
                    pageVisible={pageVisible}
                    onConfig={onConfig}
                    onPatch={onPatch}
                    onRemove={onRemove}
                    onDragStart={onDragStart}
                  />
                </div>
              ))}
            </div>
          ) : (
            width > 0 && (
              <div
                className={cx('relative', editing && 'rounded-xl bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px]')}
                style={{ height: (gridHeight(shown) + (editing ? 2 : 0)) * (ROW + GAP) }}
              >
                {shown.map((w) => (
                  <WidgetFrame
                    key={w.id}
                    widget={w}
                    editing={editing}
                    dragging={drag.current?.id === w.id}
                    pageVisible={pageVisible}
                    style={{
                      left: w.x * (colW + GAP),
                      top: w.y * (ROW + GAP),
                      width: w.w * colW + (w.w - 1) * GAP,
                      height: w.h * ROW + (w.h - 1) * GAP,
                      transition: animate ? 'left 120ms, top 120ms, width 120ms, height 120ms' : undefined,
                    }}
                    onConfig={onConfig}
                    onPatch={onPatch}
                    onRemove={onRemove}
                    onDragStart={onDragStart}
                  />
                ))}
              </div>
            )
          )}
        </div>
        </div>
        {adding && <AddWidgetDialog onAdd={add} onClose={() => setAdding(false)} />}
      </div>
    </WidgetHostContext.Provider>
  );
}
