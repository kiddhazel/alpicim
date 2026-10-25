import { netGet } from '../../../shared/lib/net';
import { AppError } from '../../../shared/lib/tauri';
import { assertIntegrationEnabled } from '../../integrations/integrationsService';
import type { PricePoint, Quote, WatchItem } from '../types';
import { toNumber, type MarketQuoteProvider, type ProviderInfo, type SymbolValidation } from './provider';

/**
 * Twelve Data — döviz, emtia (XAU/USD), hisse ve kripto fiyatları. API anahtarı gerekir.
 * Anahtar Windows Kimlik Bilgisi Yöneticisi'nde tutulur ve Rust tarafında
 * `Authorization: apikey …` başlığıyla eklenir; webview anahtarı hiç görmez.
 *
 * Borsa/sembol erişimi plana bağlıdır. BIST gibi piyasalar varsayılmaz: sembol eklenirken
 * /quote ile doğrulanır ve sağlayıcının mesajı kullanıcıya aynen gösterilir.
 */
export const TWELVEDATA_INFO: ProviderInfo = {
  id: 'twelvedata',
  name: 'Twelve Data',
  homepage: 'https://twelvedata.com',
  requiresKey: true,
  description: 'Piyasa fiyatları (döviz, altın, hisse, kripto). Plana göre gecikmeli olabilir.',
  terms: 'Ücretsiz planda dakika/gün başına kredi sınırı vardır; güncel sınırı hesabınızdaki panelden kontrol edin.',
};

const BASE = 'https://api.twelvedata.com';

/** Ücretsiz plan için temkinli varsayılan: dakikada en fazla 8 istek. */
export const RATE_LIMIT_PER_MINUTE = 8;

const recentCalls: number[] = [];

/** İstemci tarafı istek sınırlayıcı: sınır aşılacaksa istek yapılmaz. */
export function takeToken(now = Date.now(), limit = RATE_LIMIT_PER_MINUTE): boolean {
  while (recentCalls.length && now - (recentCalls[0] ?? 0) > 60_000) recentCalls.shift();
  if (recentCalls.length >= limit) return false;
  recentCalls.push(now);
  return true;
}

interface TdError {
  status?: string;
  code?: number;
  message?: string;
}

function params(item: WatchItem, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ symbol: item.symbol, ...extra });
  if (item.exchange) p.set(/^X[A-Z]{3}$/.test(item.exchange) ? 'mic_code' : 'exchange', item.exchange);
  return p.toString();
}

async function request<T>(path: string): Promise<T> {
  await assertIntegrationEnabled('twelvedata');
  if (!takeToken()) throw new AppError('RATE_LIMIT', 'İstemci tarafı sınır (dakikada 8 istek)');
  const res = await netGet({ url: `${BASE}${path}`, provider: 'twelvedata' });
  let json: unknown;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new AppError('PARSE', `Twelve Data yanıtı okunamadı (HTTP ${res.status})`);
  }
  const err = json as TdError;
  if (err.status === 'error' || !res.ok) {
    if (err.code === 429 || res.status === 429) throw new AppError('RATE_LIMIT', err.message);
    if (err.code === 401) throw new AppError('API_KEY_MISSING', err.message);
    throw new AppError('PROVIDER', err.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

interface TdQuote {
  symbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  datetime?: string;
  timestamp?: number;
  close?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  is_market_open?: boolean;
}

export function mapQuote(q: TdQuote, item: WatchItem, now = Date.now()): Quote {
  const price = toNumber(q.close);
  if (price === null) throw new AppError('PROVIDER', 'Fiyat bilgisi yok');
  const asOf = typeof q.timestamp === 'number' ? q.timestamp * 1000 : q.datetime ? Date.parse(q.datetime) : null;
  const quoteCurrency = q.currency ?? (q.symbol.includes('/') ? (q.symbol.split('/')[1] ?? '') : '');
  return {
    key: `twelvedata:${item.symbol}${item.exchange ? `@${item.exchange}` : ''}`,
    symbol: q.symbol,
    label: q.name ?? item.name ?? q.symbol,
    price,
    change: toNumber(q.change),
    changePct: toNumber(q.percent_change),
    currency: quoteCurrency,
    kind: 'market',
    providerId: TWELVEDATA_INFO.id,
    sourceName: q.exchange ? `Twelve Data · ${q.exchange}` : 'Twelve Data',
    asOf: asOf !== null && Number.isFinite(asOf) ? asOf : null,
    fetchedAt: now,
    note: q.is_market_open === false ? 'Piyasa kapalı — son kapanış' : undefined,
  };
}

interface TdSeries {
  values?: Array<{ datetime: string; close: string }>;
}

export const twelveDataProvider: MarketQuoteProvider = {
  info: TWELVEDATA_INFO,

  async getQuote(item) {
    const q = await request<TdQuote>(`/quote?${params(item)}`);
    return mapQuote(q, item);
  },

  async getDailySeries(item, points) {
    const data = await request<TdSeries>(`/time_series?${params(item, { interval: '1day', outputsize: String(points) })}`);
    return (data.values ?? [])
      .map((v) => ({ t: v.datetime, v: toNumber(v.close) }))
      .filter((p): p is PricePoint => p.v !== null)
      .reverse();
  },

  async validateSymbol(item): Promise<SymbolValidation> {
    try {
      const q = await request<TdQuote>(`/quote?${params(item)}`);
      if (toNumber(q.close) === null) return { ok: false, message: 'Sağlayıcı fiyat döndürmedi' };
      return { ok: true, name: q.name, exchange: q.exchange };
    } catch (err) {
      if (err instanceof AppError && (err.code === 'PROVIDER' || err.code === 'API_KEY_MISSING')) {
        return { ok: false, message: err.detail ?? err.code };
      }
      throw err;
    }
  },
};
