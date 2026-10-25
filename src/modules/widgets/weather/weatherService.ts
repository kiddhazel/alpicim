import type { MessageKey } from '../../../i18n';
import { netGet, netGetOk } from '../../../shared/lib/net';
import { readKey, writeKey } from '../../../shared/lib/store';
import { AppError } from '../../../shared/lib/tauri';
import { assertIntegrationEnabled } from '../../integrations/integrationsService';

/**
 * Hava durumu kaynakları:
 * - Open-Meteo (https://open-meteo.com) — anahtarsız, ücretsiz (ticari olmayan kullanım). Varsayılan.
 * - OpenWeatherMap — isteğe bağlı; kullanıcı kendi anahtarını Ayarlar → Entegrasyonlar'a girer.
 * İstekler Rust `net_get` üzerinden gider; son başarılı yanıt önbellekte tutulur.
 * Kaynak Ayarlar → Entegrasyonlar'dan kapatılmışsa `DISABLED` hatası verilir (ağa çıkılmaz).
 */

export type WeatherSource = 'openmeteo' | 'openweathermap';
export const WEATHER_SOURCES: readonly WeatherSource[] = ['openmeteo', 'openweathermap'];

export interface City {
  name: string;
  admin: string;
  country: string;
  lat: number;
  lon: number;
}

export interface Weather {
  temperature: number;
  apparent: number | null;
  humidity: number | null;
  wind: number | null;
  code: number;
  isDay: boolean;
  daily: Array<{ date: string; max: number; min: number; code: number }>;
  /** Sağlayıcının bildirdiği ölçüm zamanı (yerel saat, ISO) */
  observedAt: string | null;
  fetchedAt: number;
}

const CACHE_KEY = 'weather.cache';

export function cityKey(c: Pick<City, 'lat' | 'lon'>): string {
  return `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`;
}

export function sanitizeCity(raw: unknown): City | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.lat !== 'number' || typeof r.lon !== 'number' || typeof r.name !== 'string') return null;
  if (Math.abs(r.lat) > 90 || Math.abs(r.lon) > 180) return null;
  return {
    name: r.name.slice(0, 80),
    admin: typeof r.admin === 'string' ? r.admin.slice(0, 80) : '',
    country: typeof r.country === 'string' ? r.country.slice(0, 80) : '',
    lat: r.lat,
    lon: r.lon,
  };
}

export function parseGeocoding(body: string): City[] {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new AppError('PARSE');
  }
  const results = (data as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results
    .map((r: Record<string, unknown>) =>
      sanitizeCity({ name: r.name, admin: r.admin1 ?? '', country: r.country ?? '', lat: r.latitude, lon: r.longitude }),
    )
    .filter((c): c is City => c !== null);
}

export function parseForecast(body: string, now = Date.now()): Weather {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new AppError('PARSE');
  }
  const cur = data.current as Record<string, unknown> | undefined;
  if (!cur || typeof cur.temperature_2m !== 'number' || typeof cur.weather_code !== 'number') {
    throw new AppError('PARSE', 'Open-Meteo yanıtında güncel değer yok');
  }
  const daily = data.daily as Record<string, unknown[]> | undefined;
  const days: Weather['daily'] = [];
  if (daily && Array.isArray(daily.time)) {
    daily.time.forEach((d, i) => {
      const max = daily.temperature_2m_max?.[i];
      const min = daily.temperature_2m_min?.[i];
      const code = daily.weather_code?.[i];
      if (typeof d === 'string' && typeof max === 'number' && typeof min === 'number' && typeof code === 'number') {
        days.push({ date: d, max, min, code });
      }
    });
  }
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    temperature: cur.temperature_2m,
    apparent: n(cur.apparent_temperature),
    humidity: n(cur.relative_humidity_2m),
    wind: n(cur.wind_speed_10m),
    code: cur.weather_code,
    isDay: cur.is_day !== 0,
    daily: days,
    observedAt: typeof cur.time === 'string' ? cur.time : null,
    fetchedAt: now,
  };
}

// ---------------------------------------------------------------------------
// OpenWeatherMap (isteğe bağlı, anahtarlı). Anahtar Rust tarafında `appid` olarak eklenir.
// ---------------------------------------------------------------------------

const OWM = 'https://api.openweathermap.org';

/** OpenWeatherMap durum kodu → WMO kodu (ikon ve metin eşlemesi tek yerde kalsın diye). */
export function owmToWmo(id: number): number {
  if (id >= 200 && id < 300) return 95;
  if (id >= 300 && id < 400) return 53;
  if (id === 511) return 66;
  if (id >= 520 && id < 600) return 81;
  if (id >= 500 && id < 600) return id === 500 ? 61 : id === 501 ? 63 : 65;
  if (id >= 600 && id < 700) return 73;
  if (id >= 700 && id < 800) return 45;
  if (id === 800) return 0;
  if (id === 801) return 1;
  if (id === 802) return 2;
  if (id > 802 && id < 900) return 3;
  return -1;
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new AppError('PARSE');
  }
}

async function owmGet(path: string): Promise<unknown> {
  await assertIntegrationEnabled('openweathermap');
  const res = await netGet({ url: `${OWM}${path}`, provider: 'openweathermap' });
  const data = parseJson(res.body) as { message?: unknown };
  if (!res.ok) {
    const message = typeof data.message === 'string' ? data.message : `HTTP ${res.status}`;
    if (res.status === 401) throw new AppError('API_KEY_MISSING', message);
    if (res.status === 429) throw new AppError('RATE_LIMIT', message);
    throw new AppError('PROVIDER', message);
  }
  return data;
}

export function parseOwmGeocoding(data: unknown): City[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((r: Record<string, unknown>) => {
      const local = r.local_names as Record<string, unknown> | undefined;
      return sanitizeCity({
        name: typeof local?.tr === 'string' ? local.tr : r.name,
        admin: r.state ?? '',
        country: r.country ?? '',
        lat: r.lat,
        lon: r.lon,
      });
    })
    .filter((c): c is City => c !== null);
}

/** /data/2.5/weather + /data/2.5/forecast (3 saatlik) → ortak `Weather`. */
export function parseOwm(current: unknown, forecast: unknown, now = Date.now()): Weather {
  const c = (current ?? {}) as Record<string, unknown>;
  const main = c.main as Record<string, unknown> | undefined;
  const cond = Array.isArray(c.weather) ? (c.weather[0] as Record<string, unknown> | undefined) : undefined;
  if (!main || typeof main.temp !== 'number' || typeof cond?.id !== 'number') {
    throw new AppError('PARSE', 'OpenWeatherMap yanıtında güncel değer yok');
  }
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const wind = n((c.wind as Record<string, unknown> | undefined)?.speed);
  const offset = n(c.timezone) ?? 0;
  const dt = n(c.dt);

  // Günlük özet: yerel tarihe göre en yüksek/en düşük, öğlene en yakın durum.
  const f = (forecast ?? {}) as Record<string, unknown>;
  const fOffset = n((f.city as Record<string, unknown> | undefined)?.timezone) ?? offset;
  const byDay = new Map<string, { max: number; min: number; code: number; dist: number }>();
  for (const raw of Array.isArray(f.list) ? (f.list as Array<Record<string, unknown>>) : []) {
    const t = n(raw.dt);
    const m = raw.main as Record<string, unknown> | undefined;
    const w = Array.isArray(raw.weather) ? (raw.weather[0] as Record<string, unknown> | undefined) : undefined;
    const max = n(m?.temp_max);
    const min = n(m?.temp_min);
    if (t === null || max === null || min === null || typeof w?.id !== 'number') continue;
    const local = new Date((t + fOffset) * 1000);
    const date = local.toISOString().slice(0, 10);
    const dist = Math.abs(local.getUTCHours() - 12);
    const prev = byDay.get(date);
    if (!prev) byDay.set(date, { max, min, code: owmToWmo(w.id), dist });
    else {
      prev.max = Math.max(prev.max, max);
      prev.min = Math.min(prev.min, min);
      if (dist < prev.dist) {
        prev.code = owmToWmo(w.id);
        prev.dist = dist;
      }
    }
  }
  const daily = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([date, d]) => ({ date, max: d.max, min: d.min, code: d.code }));

  return {
    temperature: main.temp,
    apparent: n(main.feels_like),
    humidity: n(main.humidity),
    wind: wind === null ? null : wind * 3.6,
    code: owmToWmo(cond.id),
    isDay: typeof cond.icon === 'string' ? !cond.icon.endsWith('n') : true,
    daily,
    observedAt: dt === null ? null : new Date((dt + offset) * 1000).toISOString().slice(0, 16),
    fetchedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Kaynaktan bağımsız giriş noktaları
// ---------------------------------------------------------------------------

export async function searchCities(name: string, source: WeatherSource = 'openmeteo'): Promise<City[]> {
  const q = name.trim();
  if (q.length < 2) return [];
  if (source === 'openweathermap') {
    return parseOwmGeocoding(await owmGet(`/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=6`));
  }
  await assertIntegrationEnabled('openmeteo');
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=tr&format=json`;
  const res = await netGetOk({ url });
  return parseGeocoding(res.body);
}

/** Open-Meteo için eski anahtar biçimi korunur; diğer kaynaklar önekli. */
function cacheKeyFor(city: City, source: WeatherSource): string {
  return source === 'openmeteo' ? cityKey(city) : `${source}:${cityKey(city)}`;
}

export async function loadCachedWeather(city: City, source: WeatherSource = 'openmeteo'): Promise<Weather | null> {
  const cache = await readKey<Record<string, Weather>>(CACHE_KEY, {});
  return cache[cacheKeyFor(city, source)] ?? null;
}

async function fetchOpenMeteo(city: City): Promise<Weather> {
  await assertIntegrationEnabled('openmeteo');
  const params = [
    `latitude=${city.lat}`,
    `longitude=${city.lon}`,
    'current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
    'daily=temperature_2m_max,temperature_2m_min,weather_code',
    'timezone=auto',
    'forecast_days=4',
  ].join('&');
  const res = await netGetOk({ url: `https://api.open-meteo.com/v1/forecast?${params}` });
  return parseForecast(res.body);
}

async function fetchOwm(city: City): Promise<Weather> {
  const q = `lat=${city.lat}&lon=${city.lon}&units=metric`;
  const current = await owmGet(`/data/2.5/weather?${q}`);
  const forecast = await owmGet(`/data/2.5/forecast?${q}`).catch(() => null);
  return parseOwm(current, forecast);
}

export async function fetchWeather(city: City, source: WeatherSource = 'openmeteo'): Promise<Weather> {
  const weather = source === 'openweathermap' ? await fetchOwm(city) : await fetchOpenMeteo(city);
  const cache = await readKey<Record<string, Weather>>(CACHE_KEY, {});
  // Önbellekte en fazla 8 şehir.
  const entries = Object.entries({ ...cache, [cacheKeyFor(city, source)]: weather })
    .sort((a, b) => b[1].fetchedAt - a[1].fetchedAt)
    .slice(0, 8);
  await writeKey(CACHE_KEY, Object.fromEntries(entries));
  return weather;
}

/** WMO hava kodu → metin anahtarı. */
export function weatherLabelKey(code: number): MessageKey {
  if (code === 0) return 'weather.clear';
  if (code <= 2) return 'weather.partly';
  if (code === 3) return 'weather.cloudy';
  if (code === 45 || code === 48) return 'weather.fog';
  if (code >= 51 && code <= 57) return 'weather.drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'weather.rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'weather.snow';
  if (code >= 95) return 'weather.storm';
  return 'weather.unknown';
}
