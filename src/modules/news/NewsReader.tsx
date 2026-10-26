import { Bookmark, BookmarkCheck, Check, ExternalLink, Newspaper } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { t } from '../../i18n';
import { formatDateTime, formatRelative } from '../../shared/lib/time';
import { Badge, Button } from '../../shared/ui/primitives';
import type { NewsItem } from './types';

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
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-fg-2" aria-label={t('wide.readerPane')}>
        <Newspaper size={40} strokeWidth={1.5} className="text-fg-3" aria-hidden />
        <p className="text-base">{t('wide.readerEmpty')}</p>
      </div>
    );
  }
  return (
    <article
      className="relative flex h-full flex-col overflow-y-auto rounded-xl border border-stroke bg-card p-10"
      aria-label={t('wide.readerPane')}
    >
      <div className="mx-auto flex w-full max-w-[680px] flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-fg-3">
          <span className="font-semibold text-fg-2">{item.source}</span>
          <span aria-hidden>·</span>
          <span title={item.publishedAt ? formatDateTime(item.publishedAt) : undefined}>{formatRelative(item.publishedAt, now)}</span>
          <Badge>{t(`news.category.${item.category}`)}</Badge>
        </div>
        <h2 className="selectable mt-4 text-xl leading-tight font-semibold">{item.title}</h2>
        {item.summary ? (
          <p className="selectable mt-5 text-base leading-relaxed whitespace-pre-line text-fg-2">{item.summary}</p>
        ) : (
          <p className="mt-5 text-base text-fg-3">{t('wide.readerNoSummary')}</p>
        )}
        {item.alsoIn && item.alsoIn.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 text-sm font-semibold text-fg-2">{t('wide.readerAlsoIn', { n: item.alsoIn.length })}</p>
            <ul className="flex flex-wrap gap-2" aria-label={t('look.readerSources')}>
              {item.alsoIn.map((s) => (
                <li key={s}>
                  <span className="inline-flex items-center rounded-full bg-control px-3 py-1 text-sm text-fg">{s}</span>
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
        <p className="mt-auto pt-10 text-xs text-fg-3">{t('wide.readerNote')}</p>
      </div>
    </article>
  );
}
