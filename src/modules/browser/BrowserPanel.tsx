import { openUrl } from '@tauri-apps/plugin-opener';
import {
  ArrowLeft,
  ArrowRight,
  Columns2,
  ExternalLink,
  Globe,
  Home,
  Loader2,
  RotateCw,
  Rows2,
  Shield,
  ShieldCheck,
  ShieldOff,
  Square,
  Star,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { t } from '../../i18n';
import { useOverlayActive } from '../../shared/lib/overlay';
import { isTauri } from '../../shared/lib/tauri';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { cx, IconButton, Segmented, TextInput } from '../../shared/ui/primitives';
import { StateView } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { BrowserPane } from './BrowserPane';
import { BROWSER_KEYS, DEFAULT_BOOKMARKS, hostOf, sanitizeBookmarks, toUrl, type Bookmark } from './browserService';
import { TabStrip } from './TabStrip';
import { clampRatio, isSplit, tabById, type SplitMode } from './tabs';
import { useBrowserTabs } from './useBrowserTabs';
import { useTabAdblock } from './useTabAdblock';

/**
 * Uygulama içi tarayıcı: sekmeler + bölünmüş görünüm. Her sekme yerel bir WebView2 (Chromium) alt
 * penceresidir; bu bileşen yalnız araç çubuğunu ve bölmeleri çizer (durum `useBrowserTabs`'ta).
 */
export function BrowserPanel() {
  if (!isTauri()) {
    return <StateView kind="desktop" title={t('errors.desktopTitle')} description={t('errors.desktopBody')} />;
  }
  return <BrowserView />;
}

function BrowserView() {
  const toast = useToast();
  const overlay = useOverlayActive();
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const suspended = overlay || dragRatio !== null;
  const api = useBrowserTabs(suspended);
  const { state, focusedTab, focusedId } = api;
  const [bookmarks, setBookmarks] = usePersistentState<Bookmark[]>(BROWSER_KEYS.bookmarks, DEFAULT_BOOKMARKS, sanitizeBookmarks);
  const addressRef = useRef<HTMLFormElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState(false);

  const url = focusedTab?.url ?? '';
  const home = url === '';
  const rt = api.runtimeOf(focusedId);
  const canNavigate = !home && rt.opened;

  // Adres çubuğu odaklı bölmenin sekmesini izler (yazarken değiştirilmez).
  useEffect(() => {
    if (!editing) setInput(url);
  }, [url, focusedId, editing]);

  const reload = useCallback(() => api.action('reload'), [api]);
  const shield = useTabAdblock(
    state.tabs.map((x) => x.id),
    focusedId,
    url,
    reload,
  );

  const isBookmarked = !home && bookmarks.some((b) => b.url === url);
  const toggleBookmark = () => {
    if (home) return;
    const title = focusedTab?.title || hostOf(url);
    setBookmarks((list) => (list.some((b) => b.url === url) ? list.filter((b) => b.url !== url) : [...list, { url, title }]));
  };

  const openExternal = async () => {
    const target = url || toUrl(input);
    try {
      await openUrl(target, 'chrome');
    } catch {
      try {
        await openUrl(target);
      } catch {
        toast.push('error', t('news.openFailed'));
      }
    }
  };

  // Panel içindeyken tarayıcı kısayolları (sahne kısayollarından önce yakalanır).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const ctrl = (e.ctrlKey || e.metaKey) && !e.altKey;
    if (!ctrl) return;
    const key = e.key.toLowerCase();
    let handled = true;
    if (key === 't' && !e.shiftKey) api.newTab();
    else if (key === 'w' && !e.shiftKey) api.close(focusedId);
    else if (e.key === 'Tab') api.cycle(e.shiftKey ? -1 : 1);
    else if (key === 'l' && !e.shiftKey) {
      const field = addressRef.current?.querySelector('input');
      field?.focus();
      field?.select();
    } else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Bölme ayırıcısı: sürüklerken yerel webview'ler gizlenir, bırakınca oran kaydedilir.
  const vertical = state.split === 'rows';
  const ratioAt = (e: PointerEvent) => {
    const r = splitRef.current?.getBoundingClientRect();
    if (!r) return state.ratio;
    return clampRatio(vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width);
  };
  const ratio = dragRatio ?? state.ratio;

  const split = isSplit(state);
  const tab0 = tabById(state, state.panes[0]);
  const tab1 = split && state.panes[1] ? tabById(state, state.panes[1]) : undefined;
  const removeBookmark = (u: string) => setBookmarks((l) => l.filter((b) => b.url !== u));

  const shieldIcon = shield.state === 'active' ? ShieldCheck : shield.state === 'allowed' ? ShieldOff : Shield;
  const shieldTitle =
    shield.state === 'active'
      ? t('browser.shieldActive', { n: shield.blocked })
      : shield.state === 'allowed'
        ? t('browser.shieldAllowed')
        : t('browser.shieldDisabled');
  const ShieldIcon = shieldIcon;

  return (
    <div className="flex h-full flex-col outline-none" tabIndex={-1} onKeyDown={onKeyDown}>
      {/* Tek araç çubuğu bölgesi: sekme şeridi + adres satırı */}
      <div className="flex shrink-0 flex-col gap-1.5 px-3 pt-2 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <TabStrip
            state={state}
            focusedId={focusedId}
            runtimeOf={api.runtimeOf}
            onActivate={api.activate}
            onClose={api.close}
            onNew={() => api.newTab()}
            onReorder={api.reorder}
          />
          <Segmented<SplitMode>
            label={t('browser.layout')}
            value={split ? state.split : 'single'}
            onChange={api.setSplit}
            options={[
              { value: 'single', label: t('browser.layoutSingle'), icon: Square },
              { value: 'columns', label: t('browser.layoutColumns'), icon: Columns2 },
              { value: 'rows', label: t('browser.layoutRows'), icon: Rows2 },
            ]}
          />
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <IconButton icon={ArrowLeft} label={t('browser.back')} disabled={!canNavigate} onClick={() => api.action('back')} />
          <IconButton icon={ArrowRight} label={t('browser.forward')} disabled={!canNavigate} onClick={() => api.action('forward')} />
          <IconButton
            icon={rt.loading && !home ? X : RotateCw}
            label={rt.loading && !home ? t('browser.stop') : t('browser.reload')}
            disabled={!canNavigate}
            onClick={() => api.action(rt.loading ? 'stop' : 'reload')}
          />
          <IconButton icon={Home} label={t('browser.home')} active={home} onClick={api.goHome} />
          <form
            ref={addressRef}
            className="relative min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              addressRef.current?.querySelector('input')?.blur();
              api.go(input);
            }}
          >
            {rt.loading && !home ? (
              <Loader2 size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 animate-spin text-accent" />
            ) : (
              <Globe size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-3" />
            )}
            <TextInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={(e) => {
                setEditing(true);
                e.currentTarget.select();
              }}
              onBlur={() => setEditing(false)}
              placeholder={t('browser.addressPlaceholder')}
              aria-label={t('browser.addressPlaceholder')}
              spellCheck={false}
              className="h-9 w-full pl-9 text-sm"
            />
          </form>
          {shield.state !== 'unavailable' && (
            <button
              type="button"
              title={shieldTitle}
              aria-label={shieldTitle}
              aria-pressed={shield.state === 'active'}
              disabled={home || shield.state === 'disabled'}
              onClick={() => void shield.toggleSite()}
              className={cx(
                'inline-flex h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                shield.state === 'active' ? 'text-accent hover:bg-control' : 'text-fg-2 hover:bg-control hover:text-fg',
              )}
            >
              <ShieldIcon size={18} strokeWidth={1.75} />
              {shield.state === 'active' && !home && <span className="min-w-[1.5ch] tabular-nums">{shield.blocked}</span>}
            </button>
          )}
          <IconButton
            icon={Star}
            active={isBookmarked}
            label={isBookmarked ? t('browser.removeBookmark') : t('browser.addBookmark')}
            disabled={home}
            onClick={toggleBookmark}
          />
          <IconButton icon={ExternalLink} label={t('browser.openInChrome')} onClick={() => void openExternal()} />
        </div>
      </div>

      {api.ready && tab0 && (
        <div ref={splitRef} className={cx('flex min-h-0 flex-1', vertical ? 'flex-col' : 'flex-row', split && 'px-2 pb-2')}>
          <BrowserPane
            api={api}
            tab={tab0}
            pane={0}
            split={split}
            focused={!split || state.focus === 0}
            suspended={suspended}
            bookmarks={bookmarks}
            onRemoveBookmark={removeBookmark}
            style={tab1 ? { flex: `0 0 calc(${ratio * 100}% - 6px)` } : { flex: '1 1 0%' }}
          />
          {tab1 && (
            <>
              <div
                role="separator"
                aria-orientation={vertical ? 'horizontal' : 'vertical'}
                aria-label={t('browser.resizeSplit')}
                title={t('browser.resizeSplit')}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDragRatio(ratioAt(e));
                }}
                onPointerMove={(e) => {
                  if (dragRatio !== null) setDragRatio(ratioAt(e));
                }}
                onPointerUp={(e) => {
                  if (dragRatio !== null) api.setRatio(ratioAt(e));
                  setDragRatio(null);
                }}
                onPointerCancel={() => setDragRatio(null)}
                onDoubleClick={() => api.setRatio(0.5)}
                className={cx(
                  'group flex shrink-0 touch-none items-center justify-center',
                  vertical ? 'h-3 cursor-row-resize' : 'w-3 cursor-col-resize',
                )}
              >
                <span
                  className={cx(
                    'rounded-full bg-stroke-strong opacity-0 transition-opacity group-hover:opacity-100',
                    dragRatio !== null && 'bg-accent opacity-100',
                    vertical ? 'h-1 w-8' : 'h-8 w-1',
                  )}
                />
              </div>
              <BrowserPane
                api={api}
                tab={tab1}
                pane={1}
                split
                focused={state.focus === 1}
                suspended={suspended}
                bookmarks={bookmarks}
                onRemoveBookmark={removeBookmark}
                style={{ flex: '1 1 0%' }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
