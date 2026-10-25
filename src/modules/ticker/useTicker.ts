import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n';
import { useInterval } from '../../shared/lib/hooks';
import { isTauri } from '../../shared/lib/tauri';
import { useToast } from '../../shared/ui/Toast';
import { useMarkets } from '../markets/useMarkets';
import { aggregate } from '../news/newsService';
import type { NewsItem } from '../news/types';
import { useNews } from '../news/useNews';
import { useSettings } from '../settings/settings';
import { headlineChars, marqueeDurationSec, MAX_HEADLINES, nextIndex, ROTATE_MS, selectHeadlines, selectQuotes } from './ticker';

const ALL = { category: 'all', filter: 'all', search: '' } as const;
const NO_BOOKMARKS: NewsItem[] = [];

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Alt şerit: önbellekteki fiyatlar + en yeni başlıklar; hareket tercihi ve başlık açma. */
export function useTicker() {
  const [settings] = useSettings();
  const news = useNews(settings.newsRefreshMinutes);
  const markets = useMarkets(settings.marketsRefreshSeconds);
  const toast = useToast();
  const reduced = useReducedMotion();
  const animate = !settings.performanceMode && !reduced;

  const { tickerQuotes, tickerCategory, tickerSpeed } = settings;
  const quotes = useMemo(() => selectQuotes(markets.cache, tickerQuotes), [markets.cache, tickerQuotes]);
  const headlines = useMemo(
    () => selectHeadlines(aggregate(news.feeds, news.cache, NO_BOOKMARKS, news.readIds, ALL), MAX_HEADLINES, tickerCategory),
    [news.feeds, news.cache, news.readIds, tickerCategory],
  );
  const durationSec = useMemo(() => marqueeDurationSec(headlineChars(headlines), tickerSpeed), [headlines, tickerSpeed]);

  // Hareketsiz kipte her 6 sn'de bir başlık.
  const [index, setIndex] = useState(0);
  useInterval(() => setIndex((i) => nextIndex(i, headlines.length)), !animate && headlines.length > 1 ? ROTATE_MS : null);
  const current = headlines.length > 0 ? headlines[index % headlines.length] : undefined;

  const { markRead } = news;
  const openHeadline = useCallback(
    async (item: NewsItem) => {
      markRead(item.id);
      try {
        if (isTauri()) await openUrl(item.link);
        else window.open(item.link, '_blank', 'noopener');
      } catch {
        toast.push('error', t('news.openFailed'));
      }
    },
    [markRead, toast],
  );

  return { quotes, headlines, current, animate, durationSec, openHeadline, newsLoaded: news.loaded };
}
