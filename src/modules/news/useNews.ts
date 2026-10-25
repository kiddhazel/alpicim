import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInterval, useOnline } from '../../shared/lib/hooks';
import { onKeyChanged } from '../../shared/lib/store';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { useIntegrationStates } from '../integrations/useIntegrations';
import { DEFAULT_FEEDS } from './defaultFeeds';
import { effectiveFeeds, KEYS, loadCache, refreshFeeds, sanitizeFeeds, trimReadIds } from './newsService';
import type { Feed, FeedCache, NewsItem } from './types';

/**
 * Haber panelinin durumu: kaynaklar, önbellek, yer imleri, okunanlar ve otomatik yenileme.
 * `feeds` etkin entegrasyonlara göre süzülmüş listedir (Google Haberler kapalıysa yerleşik kaynaklar kapalı sayılır);
 * kaynak yöneticisi kullanıcının kendi listesini (`allFeeds`) düzenler.
 */
export function useNews(refreshMinutes: number) {
  const [allFeeds, setFeeds, storedFeedsLoaded] = usePersistentState<Feed[]>(KEYS.feeds, [...DEFAULT_FEEDS], sanitizeFeeds);
  const [integrations, , integrationsLoaded] = useIntegrationStates();
  const googleNews = integrations.googlenews;
  const feeds = useMemo(() => effectiveFeeds(allFeeds, googleNews), [allFeeds, googleNews]);
  // Entegrasyon durumları yüklenmeden ağa çıkılmaz (kapatılmış bir kaynağa istek gitmesin).
  const feedsLoaded = storedFeedsLoaded && integrationsLoaded;
  const [bookmarks, setBookmarks] = usePersistentState<NewsItem[]>(KEYS.bookmarks, [], (raw) =>
    Array.isArray(raw) ? (raw as NewsItem[]) : [],
  );
  const [readList, setReadList] = usePersistentState<string[]>(KEYS.read, [], (raw) =>
    Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [],
  );
  const [cache, setCache] = useState<FeedCache>({});
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const online = useOnline();
  const busy = useRef(false);

  const readIds = useMemo(() => new Set(readList), [readList]);
  const maxAgeMs = refreshMinutes * 60_000;

  // Önbelleği hemen göster (ağ beklemeden), diğer pencerelerin güncellemelerini izle.
  useEffect(() => {
    let alive = true;
    const pull = () =>
      void loadCache().then((c) => {
        if (!alive) return;
        setCache(c);
        setCacheLoaded(true);
      });
    pull();
    const off = onKeyChanged(KEYS.cache, pull);
    return () => {
      alive = false;
      off();
    };
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (busy.current) return;
      busy.current = true;
      setRefreshing(true);
      try {
        setCache(await refreshFeeds(feeds, { maxAgeMs, force }));
      } finally {
        busy.current = false;
        setRefreshing(false);
      }
    },
    [feeds, maxAgeMs],
  );

  // Kaynaklar yüklenince ve değiştikçe gerekenleri getir.
  useEffect(() => {
    if (feedsLoaded) void refresh(false);
  }, [feedsLoaded, refresh]);

  // Arka planda periyodik yenileme (pencere gizliyken de çalışır; taze kaynaklar atlanır).
  useInterval(() => {
    if (online) void refresh(false);
  }, feedsLoaded ? Math.max(60_000, maxAgeMs / 2) : null);

  // Bağlantı geri gelince hemen dene.
  useEffect(() => {
    if (online && feedsLoaded) void refresh(false);
  }, [online, feedsLoaded, refresh]);

  const markRead = useCallback(
    (id: string, read = true) => {
      setReadList((list) => {
        const has = list.includes(id);
        if (read && !has) return trimReadIds([...list, id]);
        if (!read && has) return list.filter((x) => x !== id);
        return list;
      });
    },
    [setReadList],
  );

  const markAllRead = useCallback(
    (ids: string[]) => setReadList((list) => trimReadIds([...new Set([...list, ...ids])])),
    [setReadList],
  );

  const enabledFeeds = feeds.filter((f) => f.enabled);
  const entries = enabledFeeds.map((f) => cache[f.id]);
  const failedFeeds = enabledFeeds.filter((f) => cache[f.id]?.error);
  const lastFetched = Math.max(0, ...entries.map((e) => e?.fetchedAt ?? 0));
  const hasAnyItems = entries.some((e) => (e?.items.length ?? 0) > 0);
  const stale = lastFetched > 0 && Date.now() - lastFetched > Math.max(maxAgeMs * 3, 30 * 60_000);

  return {
    feeds,
    allFeeds,
    /** Google Haberler RSS Ayarlar → Entegrasyonlar'dan kapatıldı. */
    googleNewsDisabled: integrationsLoaded && !googleNews,
    setFeeds,
    cache,
    loaded: feedsLoaded && cacheLoaded,
    refreshing,
    refresh,
    online,
    bookmarks,
    setBookmarks,
    readIds,
    markRead,
    markAllRead,
    failedFeeds,
    lastFetched,
    hasAnyItems,
    stale,
  };
}
