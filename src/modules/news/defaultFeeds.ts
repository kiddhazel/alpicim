import type { Feed } from './types';

/**
 * Google News RSS akışları (Türkçe, Türkiye baskısı).
 * Akışlar yalnızca başlık, kaynak adı, zaman ve özgün bağlantı içerir; haber metinleri kopyalanmaz.
 * Kullanım: kişisel, ticari olmayan okuma. Ayrıntı için README → "Haber kaynakları".
 */
const GN = 'https://news.google.com/rss';
const LOCALE = 'hl=tr&gl=TR&ceid=TR:tr';

const topic = (name: string) => `${GN}/headlines/section/topic/${name}?${LOCALE}`;
const search = (query: string) => `${GN}/search?q=${encodeURIComponent(query)}&${LOCALE}`;

export const DEFAULT_FEEDS: readonly Feed[] = [
  { id: 'gn-turkiye', name: 'Google Haberler · Türkiye', url: topic('NATION'), category: 'turkiye', enabled: true, builtin: true },
  { id: 'gn-dunya', name: 'Google Haberler · Dünya', url: topic('WORLD'), category: 'dunya', enabled: true, builtin: true },
  { id: 'gn-ekonomi', name: 'Google Haberler · Ekonomi', url: topic('BUSINESS'), category: 'ekonomi', enabled: true, builtin: true },
  { id: 'gn-teknoloji', name: 'Google Haberler · Teknoloji', url: topic('TECHNOLOGY'), category: 'teknoloji', enabled: true, builtin: true },
  { id: 'gn-bilim', name: 'Google Haberler · Bilim', url: topic('SCIENCE'), category: 'bilim', enabled: true, builtin: true },
  {
    id: 'gn-oyun',
    name: 'Google Haberler · Oyun',
    url: search('oyun OR "video oyunu" OR PlayStation OR Xbox OR Nintendo OR Steam when:7d'),
    category: 'oyun',
    enabled: true,
    builtin: true,
  },
  { id: 'gn-spor', name: 'Google Haberler · Spor', url: topic('SPORTS'), category: 'spor', enabled: true, builtin: true },
];
