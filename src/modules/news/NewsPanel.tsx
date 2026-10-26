import { openUrl } from '@tauri-apps/plugin-opener';
import { Bookmark, BookmarkCheck, Check, CheckCheck, ExternalLink, RefreshCw, Rss, Search, X } from 'lucide-react';
import { memo, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { t } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { track } from '../../shared/lib/track';
import { isTauri } from '../../shared/lib/tauri';
import { formatDateTime, formatRelative } from '../../shared/lib/time';
import { Badge, Button, cx, IconButton, Segmented, Tabs, TextInput } from '../../shared/ui/primitives';
import { SkeletonRows, StateView } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { useSettings } from '../settings/settings';
import { FeedManager } from './FeedManager';
import { aggregate, countByCategory, toggleBookmark } from './newsService';
import { useNews } from './useNews';
import { NewsReader, useElementWidth } from './NewsReader';
import { NEWS_CATEGORIES, type NewsCategory, type NewsFilter, type NewsItem } from './types';

export function NewsPanel() {
  const [settings] = useSettings();
  const news = useNews(settings.newsRefreshMinutes);
  const toast = useToast();
  const now = useNow();
  const [category, setCategory] = useState<NewsCategory | 'all'>('all');
  const [filter, setFilter] = useState<NewsFilter>('all');
  const [search, setSearch] = useState('');
  const [managing, setManaging] = useState(false);
  const [rootRef, width] = useElementWidth<HTMLDivElement>();
  const wide = width >= WIDE_MIN;
  const [selected, setSelected] = useState<NewsItem | null>(null);

  const items = useMemo(
    () => aggregate(news.feeds, news.cache, news.bookmarks, news.readIds, { category, filter, search }),
    [news.feeds, news.cache, news.bookmarks, news.readIds, category, filter, search],
  );
  const counts = useMemo(() => countByCategory(news.feeds, news.cache), [news.feeds, news.cache]);
  const bookmarkIds = useMemo(() => new Set(news.bookmarks.map((b) => b.id)), [news.bookmarks]);

  const open = async (item: NewsItem) => {
    news.markRead(item.id);
    track('news.read');
    try {
      if (isTauri()) await openUrl(item.link);
      else window.open(item.link, '_blank', 'noopener');
    } catch {
      toast.push('error', t('news.openFailed'));
    }
  };

  // Geniş görünümde seçili öğe: listede varsa güncel hâli, yoksa (filtre dışı kaldıysa) son seçilen; hiç yoksa ilk haber.
  const current = wide ? (items.find((i) => i.id === selected?.id) ?? selected ?? items[0] ?? null) : null;
  const currentIndex = current ? items.findIndex((i) => i.id === current.id) : -1;

  const select = (item: NewsItem) => {
    setSelected(item);
    news.markRead(item.id);
    track('news.read');
  };

  useEffect(() => {
    if (!wide || !current) return;
    document.getElementById(rowDomId(current.id))?.scrollIntoView({ block: 'nearest' });
  }, [wide, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!wide || e.target !== e.currentTarget || items.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = items[Math.min(items.length - 1, Math.max(0, currentIndex + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (next) select(next);
    } else if (e.key === 'Enter' && current) {
      e.preventDefault();
      void open(current);
    }
  };

  if (managing) {
    return <FeedManager feeds={news.allFeeds} onChange={news.setFeeds} onClose={() => setManaging(false)} />;
  }

  const allFailed = news.loaded && !news.hasAnyItems && news.failedFeeds.length > 0;

  return (
    <div ref={rootRef} className="flex h-full flex-col">
      {/* Araç çubuğu */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-2.5">
        <div className="relative min-w-40 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-3" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('news.searchPlaceholder')}
            aria-label={t('news.searchPlaceholder')}
            className="w-full pl-8"
          />
          {search && (
            <button
              type="button"
              aria-label={t('common.clear')}
              onClick={() => setSearch('')}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-fg-3 hover:text-fg"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <Segmented
          label={t('news.filterLabel')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('news.filterAll') },
            { value: 'unread', label: t('news.filterUnread') },
            { value: 'bookmarks', label: t('news.filterBookmarks') },
          ]}
        />
        <IconButton
          icon={CheckCheck}
          label={t('news.markAllRead')}
          onClick={() => news.markAllRead(items.map((i) => i.id))}
          disabled={items.length === 0}
        />
        <IconButton
          icon={RefreshCw}
          label={t('news.refresh')}
          spin={news.refreshing}
          disabled={news.refreshing}
          onClick={() => void news.refresh(true)}
        />
        <IconButton icon={Rss} label={t('news.manageFeeds')} onClick={() => setManaging(true)} />
      </div>

      {/* Kategoriler */}
      <div className="shrink-0 overflow-x-auto px-4">
        <Tabs
          label={t('news.categories')}
          value={category}
          onChange={setCategory}
          options={(['all', ...NEWS_CATEGORIES] as const).map((c) => ({
            value: c,
            label: t(`news.category.${c}`),
            ...(counts[c] ? { count: counts[c] } : {}),
          }))}
        />
      </div>

      {/* Durum bantları */}
      {news.googleNewsDisabled && <Banner tone="neutral">{t('integrations.newsDisabled')}</Banner>}
      {!news.online && <Banner tone="warn">{t('news.offlineBanner')}</Banner>}
      {news.online && news.stale && (
        <Banner tone="warn">{t('news.staleBanner', { time: formatRelative(news.lastFetched, now) })}</Banner>
      )}
      {news.failedFeeds.length > 0 && !allFailed && (
        <Banner tone="neutral" title={news.failedFeeds.map((f) => f.name).join('\n')}>
          {t('news.partialFailure', { n: news.failedFeeds.length })}
        </Banner>
      )}

      <div className={cx('flex min-h-0 flex-1', wide && 'gap-4 px-4 pt-3')}>
      {/* Liste */}
      <div
        className={cx('selectable min-h-0 overflow-y-auto', wide ? 'w-[620px] max-w-[50%] shrink-0 rounded-xl border border-stroke bg-card outline-none focus-visible:ring-1 focus-visible:ring-accent' : 'flex-1')}
        tabIndex={wide ? 0 : undefined}
        onKeyDown={onListKey}
      >
        {!news.loaded || (news.refreshing && !news.hasAnyItems) ? (
          <SkeletonRows />
        ) : allFailed ? (
          <StateView
            kind={news.online ? 'error' : 'offline'}
            title={news.online ? t('news.allFailedTitle') : t('errors.offlineTitle')}
            description={news.online ? t('news.allFailedBody') : t('errors.offlineBody')}
            action={
              <Button icon={RefreshCw} onClick={() => void news.refresh(true)}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <StateView
            kind="empty"
            title={
              filter === 'bookmarks'
                ? t('news.emptyBookmarks')
                : filter === 'unread'
                  ? t('news.emptyUnread')
                  : search
                    ? t('news.emptySearch')
                    : t('news.empty')
            }
          />
        ) : (
          <ul className="flex flex-col p-2">
            {items.map((item) => (
              <NewsRow
                key={item.id}
                item={item}
                now={now}
                read={news.readIds.has(item.id)}
                bookmarked={bookmarkIds.has(item.id)}
                wide={wide}
                selected={wide && current?.id === item.id}
                onSelect={() => select(item)}
                onOpen={() => void open(item)}
                onToggleRead={() => news.markRead(item.id, !news.readIds.has(item.id))}
                onToggleBookmark={() => news.setBookmarks((list) => toggleBookmark(list, item))}
              />
            ))}
          </ul>
        )}
      </div>
      {wide && (
        <div className="min-h-0 min-w-0 flex-1 pb-3">
          <NewsReader
            item={current}
            now={now}
            read={current ? news.readIds.has(current.id) : false}
            bookmarked={current ? bookmarkIds.has(current.id) : false}
            onOpen={() => current && void open(current)}
            onToggleRead={() => current && news.markRead(current.id, !news.readIds.has(current.id))}
            onToggleBookmark={() => current && news.setBookmarks((list) => toggleBookmark(list, current))}
          />
        </div>
      )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-stroke px-4 py-2 text-xs text-fg-3">
        <span>
          {news.lastFetched ? t('news.updated', { time: formatRelative(news.lastFetched, now) }) : t('news.neverUpdated')}
        </span>
        <span>{t('news.count', { n: items.length })}</span>
      </footer>
    </div>
  );
}

function Banner({ tone, children, title }: { tone: 'warn' | 'neutral'; children: ReactNode; title?: string }) {
  return (
    <div
      title={title}
      className={cx(
        'shrink-0 border-b border-stroke px-4 py-2 text-xs',
        tone === 'warn' ? 'bg-warn/10 text-warn' : 'bg-layer text-fg-2',
      )}
    >
      {children}
    </div>
  );
}

const WIDE_MIN = 1100;

const rowDomId = (id: string) => `news-row-${id}`;

interface RowProps {
  item: NewsItem;
  wide: boolean;
  selected: boolean;
  onSelect: () => void;
  now: number;
  read: boolean;
  bookmarked: boolean;
  onOpen: () => void;
  onToggleRead: () => void;
  onToggleBookmark: () => void;
}

const NewsRow = memo(function NewsRow({ item, wide, selected, onSelect, now, read, bookmarked, onOpen, onToggleRead, onToggleBookmark }: RowProps) {
  return (
    <li
      id={rowDomId(item.id)}
      className={cx(
        'group relative rounded-lg px-4 py-3 transition-colors duration-150',
        selected ? 'bg-accent-soft' : 'hover:bg-card-hover',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cx('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', read ? 'bg-transparent' : 'bg-accent')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-3">
            <span className="font-semibold text-fg-2">{item.source}</span>
            <span aria-hidden>·</span>
            <span title={item.publishedAt ? formatDateTime(item.publishedAt) : undefined}>
              {formatRelative(item.publishedAt, now)}
            </span>
            <Badge>{t(`news.category.${item.category}`)}</Badge>
            {item.alsoIn && item.alsoIn.length > 0 && (
              <span title={item.alsoIn.join(', ')}>{t('news.alsoIn', { n: item.alsoIn.length })}</span>
            )}
          </div>
          <a
            href={item.link}
            onClick={(e) => {
              e.preventDefault();
              if (wide) onSelect();
              else onOpen();
            }}
            className={cx(
              'mt-1 block text-base leading-snug hover:underline',
              read ? 'font-normal text-fg-2' : 'font-semibold text-fg',
            )}
          >
            {item.title}
          </a>
          {item.summary && <p className="mt-1 line-clamp-2 text-sm text-fg-2">{item.summary}</p>}
        </div>
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <IconButton
            size="sm"
            icon={bookmarked ? BookmarkCheck : Bookmark}
            active={bookmarked}
            label={bookmarked ? t('news.removeBookmark') : t('news.addBookmark')}
            onClick={onToggleBookmark}
          />
          <IconButton
            size="sm"
            icon={Check}
            active={read}
            label={read ? t('news.markUnread') : t('news.markRead')}
            onClick={onToggleRead}
          />
          <IconButton size="sm" icon={ExternalLink} label={t('news.openSource')} onClick={onOpen} />
        </div>
      </div>
    </li>
  );
});
