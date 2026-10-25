import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { matchesSearch, moveItem } from '../modules/launcher/launcherService';
import { dockPanel, sanitizeMainLayout, undockPanel } from '../modules/window-manager/mainLayout';
import { panelFromLabel } from '../modules/window-manager/panels';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../modules/settings/settings';
import { sanitizeFeeds, validateFeedUrl } from '../modules/news/newsService';
import { DEFAULT_FEEDS } from '../modules/news/defaultFeeds';
import { formatRelative } from './lib/time';
import { mapLimit } from './lib/net';

describe('i18n', () => {
  it('parametreleri yerleştirir', () => {
    expect(t('news.count', { n: 12 })).toBe('12 haber');
    expect(t('news.category.spor')).toBe('Spor');
  });
});

describe('zaman biçimleme', () => {
  const now = Date.UTC(2026, 9, 25, 12, 0);
  it('göreli zamanları Türkçe yazar', () => {
    expect(formatRelative(now - 20_000, now)).toBe('az önce');
    expect(formatRelative(now - 5 * 60_000, now)).toBe('5 dk önce');
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe('3 sa önce');
    expect(formatRelative(null, now)).toBe('zaman bilinmiyor');
  });
});

describe('ayarlar', () => {
  it('sınır dışı ve bozuk değerleri düzeltir', () => {
    const s = sanitizeSettings({ theme: 'mor', newsRefreshMinutes: 1, marketsRefreshSeconds: 99999, closeToTray: 'evet' });
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(s.newsRefreshMinutes).toBe(5);
    expect(s.marketsRefreshSeconds).toBe(3600);
    expect(s.closeToTray).toBe(true);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({ barTicker: true, barPlayer: true, tickerSpeed: 'normal', tickerCategory: 'all', tickerQuotes: 4 });
  });
  it('alt çubuk ayarlarını doğrular', () => {
    const bad = sanitizeSettings({ barTicker: 'x', barPlayer: 0, tickerSpeed: 'ışık', tickerCategory: 'yok', tickerQuotes: 99 });
    expect(bad).toMatchObject({ barTicker: true, barPlayer: true, tickerSpeed: 'normal', tickerCategory: 'all', tickerQuotes: 8 });
    const ok = sanitizeSettings({ barTicker: false, barPlayer: false, tickerSpeed: 'fast', tickerCategory: 'spor', tickerQuotes: -3 });
    expect(ok).toMatchObject({ barTicker: false, barPlayer: false, tickerSpeed: 'fast', tickerCategory: 'spor', tickerQuotes: 0 });
  });
});

describe('pencere düzeni', () => {
  it('panel etiketlerini çözer', () => {
    expect(panelFromLabel('panel-news')).toBe('news');
    expect(panelFromLabel('panel-bilinmeyen')).toBeNull();
    expect(panelFromLabel('main')).toBeNull();
  });

  it('ayır/döndür ana düzeni doğru günceller', () => {
    const base = sanitizeMainLayout({ preset: 'three', docked: ['news', 'markets', 'news', 'xyz'], focused: 'markets' });
    expect(base.docked).toEqual(['news', 'markets']);
    const undocked = undockPanel(base, 'markets');
    expect(undocked.docked).toEqual(['news']);
    expect(undocked.focused).toBe('news');
    const docked = dockPanel(undocked, 'launcher');
    expect(docked.docked).toEqual(['news', 'launcher']);
    expect(docked.focused).toBe('launcher');
  });
});

describe('haber kaynakları', () => {
  it('yerleşik kaynakları korur, bozuk kayıtları atar', () => {
    const feeds = sanitizeFeeds([
      { id: 'custom-1', name: 'Blog', url: 'https://blog.example/rss', category: 'bilim', enabled: false, builtin: false },
      { id: 'kotu', url: 'https://x', category: 'yok' },
    ]);
    expect(feeds.find((f) => f.id === 'custom-1')?.enabled).toBe(false);
    expect(feeds.some((f) => f.id === 'kotu')).toBe(false);
    expect(feeds.filter((f) => f.builtin)).toHaveLength(DEFAULT_FEEDS.length);
  });

  it('akış adresini doğrular', () => {
    expect(validateFeedUrl('https://ornek.com/rss')).toBeNull();
    expect(validateFeedUrl('ftp://ornek.com/rss')).toBe('feeds.invalidProtocol');
    expect(validateFeedUrl('rss')).toBe('feeds.invalidUrl');
  });
});

describe('başlatıcı yardımcıları', () => {
  it('aksan ve büyük harf duyarsız arar', () => {
    const item = { name: 'Görüntü Düzenleyici', category: 'Tasarım', path: 'C:\\Apps\\editor.exe' };
    expect(matchesSearch(item, 'goruntu')).toBe(true);
    expect(matchesSearch(item, 'TASARIM editor')).toBe(true);
    expect(matchesSearch(item, 'oyun')).toBe(false);
  });

  it('öğeyi yeni konuma taşır', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});

describe('mapLimit', () => {
  it('eşzamanlılığı sınırlar ve sırayı korur', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
