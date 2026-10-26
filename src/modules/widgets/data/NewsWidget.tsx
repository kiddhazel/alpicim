import { openUrl } from '@tauri-apps/plugin-opener';
import { useMemo } from 'react';
import { t } from '../../../i18n';
import { useNow } from '../../../shared/lib/hooks';
import { isTauri } from '../../../shared/lib/tauri';
import { formatRelative } from '../../../shared/lib/time';
import { Select, TextInput } from '../../../shared/ui/primitives';
import { StateView } from '../../../shared/ui/StateView';
import { useToast } from '../../../shared/ui/Toast';
import { aggregate } from '../../news/newsService';
import { NEWS_CATEGORIES, isNewsCategory, type NewsCategory, type NewsItem } from '../../news/types';
import { useNews } from '../../news/useNews';
import { useSettings } from '../../settings/settings';
import { track } from '../../../shared/lib/track';
import { num, obj, type WidgetProps, type WidgetSettingsProps } from '../types';

export interface NewsConfig {
  category: NewsCategory | 'all';
  count: number;
}

export const newsDefaults: NewsConfig = { category: 'all', count: 8 };

export function sanitizeNewsWidget(raw: unknown): NewsConfig {
  const r = obj(raw);
  return { category: isNewsCategory(r.category) ? r.category : 'all', count: num(r.count, 3, 30, 8) };
}

/** En yeni başlıklar (haber panelinin önbelleği ve yenileme kurallarıyla). */
export function NewsWidget({ config }: WidgetProps<NewsConfig>) {
  const [settings] = useSettings();
  const news = useNews(settings.newsRefreshMinutes * (settings.performanceMode ? 2 : 1));
  const toast = useToast();
  const now = useNow();

  const items = useMemo(
    () =>
      aggregate(news.feeds, news.cache, news.bookmarks, news.readIds, { category: config.category, filter: 'all', search: '' })
        .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
        .slice(0, config.count),
    [news.feeds, news.cache, news.bookmarks, news.readIds, config.category, config.count],
  );

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

  if (!news.loaded) return <StateView compact kind="loading" title={t('common.loading')} />;
  if (items.length === 0) {
    return news.refreshing ? (
      <StateView compact kind="loading" title={t('common.loading')} />
    ) : (
      <StateView compact kind={news.online ? 'empty' : 'offline'} title={news.online ? t('news.empty') : t('errors.offlineTitle')} />
    );
  }
  return (
    <ul className="h-full divide-y divide-line overflow-y-auto">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => void open(item)}
            className="w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-3"
            title={item.summary || item.title}
          >
            <p className={news.readIds.has(item.id) ? 'line-clamp-2 text-sm text-muted' : 'line-clamp-2 text-sm font-medium'}>
              {item.title}
            </p>
            <p className="text-xs text-faint">
              {item.source} · {formatRelative(item.publishedAt, now)}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function NewsSettings({ config, setConfig }: WidgetSettingsProps<NewsConfig>) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex items-center justify-between gap-2">
        {t('feeds.categoryLabel')}
        <Select value={config.category} onChange={(e) => setConfig({ category: e.target.value as NewsConfig['category'] })}>
          <option value="all">{t('news.category.all')}</option>
          {NEWS_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`news.category.${c}`)}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex items-center justify-between gap-2">
        {t('widgets.news.count')}
        <TextInput
          type="number"
          min={3}
          max={30}
          value={config.count}
          onChange={(e) => setConfig({ count: num(Number(e.target.value), 3, 30, 8) })}
          className="tabular w-20 text-right"
        />
      </label>
    </div>
  );
}
