import { describe, expect, it } from 'vitest';
import { tr } from '../../i18n/tr';
import { refreshMarkets } from '../markets/marketService';
import { DEFAULT_MARKETS_CONFIG } from '../markets/types';
import { DEFAULT_FEEDS } from '../news/defaultFeeds';
import { effectiveFeeds } from '../news/newsService';
import { owmToWmo, parseOwm, parseOwmGeocoding } from '../widgets/weather/weatherService';
import { describeError } from '../../shared/ui/StateView';
import { AppError } from '../../shared/lib/tauri';
import {
  defaultIntegrationStates,
  getIntegration,
  groupByCategory,
  INTEGRATION_CATEGORIES,
  INTEGRATIONS,
  integrationStatus,
  isIntegrationId,
  isUsable,
  sanitizeIntegrationStates,
} from './registry';

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tr);
}

describe('entegrasyon kaydı', () => {
  it('kimlikler benzersiz, metinler tr.ts içinde, adresler https', () => {
    const ids = INTEGRATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of INTEGRATIONS) {
      for (const key of [d.name, d.description, d.powers]) expect(typeof lookup(key)).toBe('string');
      expect(d.homepage.startsWith('https://')).toBe(true);
      if (d.key) {
        expect(d.key.signupUrl.startsWith('https://')).toBe(true);
        expect(d.key.providerId).toMatch(/^[a-z0-9]+$/);
      }
      expect(INTEGRATION_CATEGORIES).toContain(d.category);
      expect(typeof lookup(`integrations.category.${d.category}`)).toBe('string');
      if (d.control === 'settings') expect(d.settingsSection).toBeTruthy();
    }
  });

  it('anahtarlı sağlayıcılar Rust tablosuyla aynı kimlikleri kullanır', () => {
    // src-tauri/src/providers.rs::PROVIDERS ile eşleşmeli (orada da birim testi var).
    const keyed = INTEGRATIONS.flatMap((d) => (d.key ? [d.key.providerId] : [])).sort();
    expect(keyed).toEqual(['openweathermap', 'twelvedata']);
  });

  it('kategoriye göre gruplar, boş kategori yok', () => {
    const groups = groupByCategory();
    expect(groups.flatMap(([, list]) => list)).toHaveLength(INTEGRATIONS.length);
    expect(groups.every(([, list]) => list.length > 0)).toBe(true);
  });

  it('isIntegrationId / getIntegration', () => {
    expect(isIntegrationId('tcmb')).toBe(true);
    expect(isIntegrationId('evil')).toBe(false);
    expect(isIntegrationId(3)).toBe(false);
    expect(getIntegration('openweathermap').key?.providerId).toBe('openweathermap');
  });
});

describe('durumların doğrulanması', () => {
  it('bozuk veri varsayılana döner', () => {
    expect(sanitizeIntegrationStates(null)).toEqual(defaultIntegrationStates());
    expect(sanitizeIntegrationStates([true])).toEqual(defaultIntegrationStates());
    expect(sanitizeIntegrationStates('x')).toEqual(defaultIntegrationStates());
  });

  it('yalnızca "toggle" türü kapatılabilir; bilinmeyen alanlar atılır', () => {
    const s = sanitizeIntegrationStates({ tcmb: false, favicons: false, adblock: false, youtubemusic: false, evil: true, openmeteo: 'no' });
    expect(s.tcmb).toBe(false);
    expect(s.favicons).toBe(false);
    expect(s.adblock).toBe(true);
    expect(s.youtubemusic).toBe(true);
    expect(s.openmeteo).toBe(true);
    expect('evil' in s).toBe(false);
  });

  it('durum rozeti', () => {
    const td = getIntegration('twelvedata');
    const om = getIntegration('openmeteo');
    expect(integrationStatus(om, true, null)).toBe('keyless');
    expect(integrationStatus(om, false, null)).toBe('off');
    expect(integrationStatus(td, true, null)).toBeNull();
    expect(integrationStatus(td, true, false)).toBe('keyRequired');
    expect(integrationStatus(td, true, true)).toBe('keyStored');
    expect(integrationStatus(td, false, true)).toBe('off');
    expect(isUsable('keyless')).toBe(true);
    expect(isUsable('keyStored')).toBe(true);
    expect(isUsable('keyRequired')).toBe(false);
    expect(isUsable('off')).toBe(false);
    expect(isUsable(null)).toBe(false);
  });

  it('DISABLED hatası kurulum görünümüne çevrilir', () => {
    const d = describeError(new AppError('DISABLED', 'tcmb'));
    expect(d.kind).toBe('setup');
    expect(d.description).toContain('Entegrasyonlar');
  });
});

describe('haber entegrasyonu', () => {
  it('Google Haberler kapalıyken yerleşik kaynaklar kapalı sayılır, kullanıcı kaynakları değişmez', () => {
    const custom = { id: 'custom-1', name: 'Benim', url: 'https://ornek.com/rss', category: 'dunya' as const, enabled: true, builtin: false };
    const feeds = [...DEFAULT_FEEDS, custom];
    const off = effectiveFeeds(feeds, false);
    expect(off.filter((f) => f.builtin).every((f) => !f.enabled)).toBe(true);
    expect(off.find((f) => f.id === 'custom-1')?.enabled).toBe(true);
    expect(effectiveFeeds(feeds, true)).toEqual(feeds);
    // Girdi değiştirilmez.
    expect(DEFAULT_FEEDS.every((f) => f.enabled)).toBe(true);
  });
});

describe('piyasa entegrasyonları', () => {
  it('kapalı sağlayıcılar ağa çıkmadan DISABLED olarak işaretlenir', async () => {
    const cache = await refreshMarkets({
      config: { ...DEFAULT_MARKETS_CONFIG, currencies: ['USD'] },
      liveMaxAgeMs: 60_000,
      hasKey: true,
      enabled: { tcmb: false, frankfurter: false, twelvedata: false },
    });
    expect(cache.reference).toEqual({ data: [], error: 'DISABLED', fetchedAt: 0 });
    expect(cache.history['USD/TRY']?.error).toBe('DISABLED');
    expect(cache.live).toBeNull();
    expect(cache.gold).toBeNull();
  });
});

describe('OpenWeatherMap', () => {
  it('durum kodlarını WMO kodlarına eşler', () => {
    expect(owmToWmo(800)).toBe(0);
    expect(owmToWmo(801)).toBe(1);
    expect(owmToWmo(804)).toBe(3);
    expect(owmToWmo(211)).toBe(95);
    expect(owmToWmo(301)).toBe(53);
    expect(owmToWmo(500)).toBe(61);
    expect(owmToWmo(502)).toBe(65);
    expect(owmToWmo(511)).toBe(66);
    expect(owmToWmo(521)).toBe(81);
    expect(owmToWmo(601)).toBe(73);
    expect(owmToWmo(741)).toBe(45);
  });

  it('anlık hava + 3 saatlik tahmini günlük özete çevirir', () => {
    const current = {
      dt: 1_760_000_000,
      timezone: 10_800,
      main: { temp: 18.4, feels_like: 17.9, humidity: 60 },
      wind: { speed: 5 },
      weather: [{ id: 803, icon: '04n' }],
    };
    const day = (iso: string, max: number, min: number, id: number) => ({
      dt: Date.parse(`${iso}Z`) / 1000 - 10_800,
      main: { temp_max: max, temp_min: min },
      weather: [{ id }],
    });
    const forecast = {
      city: { timezone: 10_800 },
      list: [
        day('2026-10-25T09:00:00', 15, 10, 500),
        day('2026-10-25T12:00:00', 19, 14, 800),
        day('2026-10-25T21:00:00', 13, 9, 801),
        day('2026-10-26T12:00:00', 21, 12, 600),
        { dt: 'bozuk' },
      ],
    };
    const w = parseOwm(current, forecast, 42);
    expect(w.temperature).toBe(18.4);
    expect(w.code).toBe(3);
    expect(w.isDay).toBe(false);
    expect(w.wind).toBeCloseTo(18);
    expect(w.fetchedAt).toBe(42);
    expect(w.daily).toEqual([
      { date: '2026-10-25', max: 19, min: 9, code: 0 },
      { date: '2026-10-26', max: 21, min: 12, code: 73 },
    ]);
  });

  it('eksik yanıtta PARSE hatası; tahmin yoksa günlük boş', () => {
    expect(() => parseOwm({}, null)).toThrow();
    const w = parseOwm({ main: { temp: 1 }, weather: [{ id: 800, icon: '01d' }] }, null);
    expect(w.daily).toEqual([]);
    expect(w.isDay).toBe(true);
  });

  it('şehir aramasında Türkçe adı tercih eder ve geçersizleri atar', () => {
    const cities = parseOwmGeocoding([
      { name: 'Istanbul', local_names: { tr: 'İstanbul' }, lat: 41.0, lon: 28.9, country: 'TR', state: 'İstanbul' },
      { name: 'Bozuk', lat: 200, lon: 0 },
    ]);
    expect(cities).toEqual([{ name: 'İstanbul', admin: 'İstanbul', country: 'TR', lat: 41.0, lon: 28.9 }]);
    expect(parseOwmGeocoding({ cod: 401 })).toEqual([]);
  });
});
