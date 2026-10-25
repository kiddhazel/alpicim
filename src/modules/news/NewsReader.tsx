import { Bookmark, BookmarkCheck, Check, ExternalLink, Newspaper } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { t } from '../../i18n';
import { formatDateTime, formatRelative } from '../../shared/lib/time';
import { Button } from '../../shared/ui/primitives';
import type { NewsCategory, NewsItem } from './types';

/** Bir öğenin içerik genişliğini (px) izler; görünüm medya sorgusuyla değil kapsayıcı genişliğiyle seçilir. */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Kategori renk tonu (okunabilir her iki temada). */
export const CATEGORY_HUE: Record<NewsCategory, string> = {
  turkiye: '#ef4444',
  dunya: '#38bdf8',
  ekonomi: '#10b981',
  teknoloji: '#8b5cf6',
  bilim: '#06b6d4',
  oyun: '#ec4899',
  spor: '#f97316',
};

export function CategoryBadge({ category }: { category: NewsCategory }) {
  const hue = CATEGORY_HUE[category];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs leading-4 font-semibold"
      style={{ color: hue, backgroundColor: `color-mix(in srgb, ${hue} 16%, transparent)` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hue }} />
      {t(`news.category.${category}`)}
    </span>
  );
}

interface Props {
  item: NewsItem | null;
  now: number;
  read: boolean;
  bookmarked: boolean;
  onOpen: () => void;
  onToggleRead: () => void;
  onToggleBookmark: () => void;
}

export function NewsReader({ item, now, read, bookmarked, onOpen, onToggleRead, onToggleBookmark }: Props) {
  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted" aria-label={t('wide.readerPane')}>
        <Newspaper size={40} strokeWidth={1.5} className="text-faint" aria-hidden />
        <p className="text-base">{t('wide.readerEmpty')}</p>
      </div>
    );
  }
  return (
    <article
      className="glass relative flex h-full flex-col overflow-y-auto rounded-2xl p-10"
      style={{ backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${CATEGORY_HUE[item.category]} 14%, transparent), transparent 40%)` }}
      aria-label={t('wide.readerPane')}
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
          <CategoryBadge category={item.category} />
          <span className="font-medium text-fg">{item.source}</span>
          <span title={item.publishedAt ? formatDateTime(item.publishedAt) : undefined}>{formatRelative(item.publishedAt, now)}</span>
        </div>
        <h2 className="selectable mt-5 font-display text-3xl leading-tight font-semibold tracking-tight">{item.title}</h2>
        {item.summary ? (
          <p className="selectable mt-6 text-md leading-relaxed whitespace-pre-line text-fg/90">{item.summary}</p>
        ) : (
          <p className="mt-6 text-md text-faint">{t('wide.readerNoSummary')}</p>
        )}
        {item.alsoIn && item.alsoIn.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 text-sm font-medium text-muted">{t('wide.readerAlsoIn', { n: item.alsoIn.length })}</p>
            <ul className="flex flex-wrap gap-2" aria-label={t('look.readerSources')}>
              {item.alsoIn.map((s) => (
                <li key={s}>
                  <span className="inline-flex items-center rounded-full bg-surface-3 px-3 py-1 text-sm text-fg">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-10 flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={ExternalLink} onClick={onOpen}>
            {t('news.openSource')}
          </Button>
          <Button icon={bookmarked ? BookmarkCheck : Bookmark} onClick={onToggleBookmark}>
            {bookmarked ? t('news.removeBookmark') : t('news.addBookmark')}
          </Button>
          <Button icon={Check} onClick={onToggleRead}>
            {read ? t('news.markUnread') : t('news.markRead')}
          </Button>
        </div>
        <p className="mt-auto pt-10 text-xs text-faint">{t('wide.readerNote')}</p>
      </div>
    </article>
  );
}
