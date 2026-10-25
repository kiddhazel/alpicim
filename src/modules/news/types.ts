export type NewsCategory = 'turkiye' | 'dunya' | 'ekonomi' | 'teknoloji' | 'bilim' | 'oyun' | 'spor';

export const NEWS_CATEGORIES: readonly NewsCategory[] = [
  'turkiye',
  'dunya',
  'ekonomi',
  'teknoloji',
  'bilim',
  'oyun',
  'spor',
];

export function isNewsCategory(value: unknown): value is NewsCategory {
  return NEWS_CATEGORIES.includes(value as NewsCategory);
}

export interface Feed {
  id: string;
  name: string;
  url: string;
  category: NewsCategory;
  enabled: boolean;
  /** Uygulamayla gelen kaynak mı (silinemez, yalnız kapatılabilir)? */
  builtin: boolean;
}

export interface NewsItem {
  /** Bağlantıdan türetilen kararlı kimlik. */
  id: string;
  title: string;
  link: string;
  source: string;
  /** Yayın zamanı (ms). Kaynak vermiyorsa null. */
  publishedAt: number | null;
  /** Kaynağın verdiği kısa açıklama (HTML temizlenmiş, kısaltılmış). */
  summary: string;
  category: NewsCategory;
  feedId: string;
  /** Aynı haberi veren diğer kaynaklar (tekrar ayıklamasından sonra). */
  alsoIn?: string[];
}

export interface FeedCacheEntry {
  feedId: string;
  /** Son başarılı ya da 304 yanıtlı kontrol zamanı. */
  fetchedAt: number;
  /** Son deneme zamanı (başarısız olsa da). */
  attemptedAt: number;
  etag: string | null;
  lastModified: string | null;
  items: NewsItem[];
  error: string | null;
}

export type FeedCache = Record<string, FeedCacheEntry>;

export type NewsFilter = 'all' | 'unread' | 'bookmarks';
