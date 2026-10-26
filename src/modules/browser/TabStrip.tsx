import { Globe, Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n';
import { cx, IconButton } from '../../shared/ui/primitives';
import { hostOf } from './browserService';
import { SiteIcon } from './SiteIcon';
import { MAX_TABS, paneOf, type BrowserTab, type TabsState } from './tabs';
import type { TabRuntime } from './useBrowserTabs';

export function tabLabel(tab: BrowserTab): string {
  return tab.title || (tab.url ? hostOf(tab.url) : t('browser.newTab'));
}

export function TabIcon({ tab, loading }: { tab: BrowserTab; loading: boolean }) {
  if (loading) return <Loader2 size={14} className="shrink-0 animate-spin text-accent" />;
  if (!tab.url) return <Globe size={14} className="shrink-0 text-fg-3" />;
  return <SiteIcon url={tab.url} size={16} className="rounded-sm" />;
}

/** Sekme şeridi: tıkla = odaklı bölmede göster, orta tık / × = kapat, sürükle = sırala, + = yeni sekme. */
export function TabStrip({
  state,
  focusedId,
  runtimeOf,
  onActivate,
  onClose,
  onNew,
  onReorder,
}: {
  state: TabsState;
  focusedId: string;
  runtimeOf: (id: string) => TabRuntime;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onReorder: (id: string, index: number) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  return (
    <div role="tablist" aria-label={t('browser.tabs')} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {state.tabs.map((tab, index) => {
        const focused = tab.id === focusedId;
        const shown = paneOf(state, tab.id) !== null;
        const label = tabLabel(tab);
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={focused}
            tabIndex={0}
            title={tab.url ? `${label}\n${tab.url}` : label}
            draggable
            onDragStart={(e) => {
              setDragId(tab.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) onReorder(dragId, index);
              setDragId(null);
            }}
            onClick={() => onActivate(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate(tab.id);
              }
            }}
            onMouseDown={(e) => {
              // Orta tuş: otomatik kaydırmayı engelle.
              if (e.button === 1) e.preventDefault();
            }}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                onClose(tab.id);
              }
            }}
            className={cx(
              'group relative flex h-8 max-w-[200px] min-w-[96px] flex-1 cursor-default items-center gap-1.5 rounded-lg pr-1 pl-2 text-sm transition-colors select-none',
              focused ? 'bg-control text-fg' : shown ? 'bg-control text-fg' : 'text-fg-2 hover:bg-control hover:text-fg',
              dragId === tab.id && 'opacity-50',
            )}
          >
            <TabIcon tab={tab} loading={runtimeOf(tab.id).loading} />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <button
              type="button"
              aria-label={t('browser.closeTab')}
              title={t('browser.closeTab')}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className={cx(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-fg-3 hover:bg-control hover:text-fg',
                !focused && 'opacity-0 group-hover:opacity-100 focus:opacity-100',
              )}
            >
              <X size={14} />
            </button>
            {focused && <span className="absolute right-2 bottom-0 left-2 h-0.5 rounded-full bg-accent" />}
          </div>
        );
      })}
      <IconButton
        icon={Plus}
        size="sm"
        label={`${t('browser.newTab')} (Ctrl+T)`}
        disabled={state.tabs.length >= MAX_TABS}
        onClick={onNew}
      />
    </div>
  );
}
