import { Loader2 } from 'lucide-react';
import { useRef, type CSSProperties } from 'react';
import { t } from '../../i18n';
import { useNativeBounds } from '../../shared/lib/useNativeBounds';
import { Button, cx } from '../../shared/ui/primitives';
import { StateView } from '../../shared/ui/StateView';
import type { Bookmark } from './browserService';
import { StartPage } from './StartPage';
import { TabIcon, tabLabel } from './TabStrip';
import type { BrowserTab, PaneIndex } from './tabs';
import type { BrowserTabsApi } from './useBrowserTabs';

/**
 * Bir bölme: üstüne sekmenin yerel webview'i yerleştirilen alan. Başlangıç sayfası, hata ve
 * "gizli" (menü açıkken / ayırıcı sürüklenirken) durumları HTML olarak burada çizilir.
 */
export function BrowserPane({
  api,
  tab,
  pane,
  split,
  focused,
  suspended,
  bookmarks,
  onRemoveBookmark,
  style,
}: {
  api: BrowserTabsApi;
  tab: BrowserTab;
  pane: PaneIndex;
  split: boolean;
  focused: boolean;
  suspended: boolean;
  bookmarks: Bookmark[];
  onRemoveBookmark: (url: string) => void;
  style?: CSSProperties;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const home = tab.url === '';
  const rt = api.runtimeOf(tab.id);
  const { place } = api;

  useNativeBounds(contentRef, (b) => place(tab.id, b), [tab.id, suspended, home, place]);

  const open = (url: string) => {
    api.focus(pane);
    api.go(url, tab.id);
  };

  return (
    <div
      style={style}
      className={cx(
        'flex min-h-0 min-w-0 flex-col rounded-xl',
        split && 'p-0.5',
        split && (focused ? 'bg-accent' : 'bg-layer'),
      )}
      onMouseDown={() => {
        if (!focused) api.focus(pane);
      }}
    >
      {split && (
        <button
          type="button"
          title={t('browser.focusPane')}
          onClick={() => api.focus(pane)}
          className={cx(
            'flex h-7 shrink-0 items-center gap-1.5 px-2 text-left text-xs',
            focused ? 'text-on-accent' : 'text-fg-2 hover:text-fg',
          )}
        >
          <TabIcon tab={tab} loading={rt.loading} />
          <span className="min-w-0 flex-1 truncate">{tabLabel(tab)}</span>
        </button>
      )}
      {/* Yerel webview bu alanın üstüne yerleştirilir. */}
      <div ref={contentRef} className={cx('relative min-h-0 flex-1 bg-card', split && 'overflow-hidden rounded-[10px]')}>
        {home ? (
          <StartPage bookmarks={bookmarks} onOpen={open} onRemove={onRemoveBookmark} autoFocus={focused} />
        ) : rt.failed ? (
          <StateView
            kind="error"
            title={t('browser.openFailed')}
            description={tab.url}
            action={<Button onClick={() => api.retry(tab.id)}>{t('common.retry')}</Button>}
          />
        ) : suspended || !rt.opened ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-fg-3">
            {!rt.opened && !suspended && <Loader2 size={20} className="animate-spin text-accent" />}
            <span className="max-w-full truncate">{tabLabel(tab)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
