import { readKey, writeKey } from '../../shared/lib/store';
import { toAppError } from '../../shared/lib/tauri';
import { hasIntegrationKey } from '../integrations/integrationsService';
import { frankfurterProvider } from './adapters/frankfurter';
import { tcmbProvider } from './adapters/tcmb';
import { twelveDataProvider } from './adapters/twelvedata';
import type { MarketsConfig, PricePoint, Quote, Section, WatchItem } from './types';
import { DEFAULT_MARKETS_CONFIG } from './types';

export const MARKET_KEYS = {
  config: 'markets.config',
  cache: 'markets.cache',
} as const;

/** 1 ons = 31,1034768 gram */
export const GRAMS_PER_TROY_OUNCE = 31.1034768;

/** Referans kurlar günde bir değişir; bu süreden sık sorgulanmaz. */
const REFERENCE_MAX_AGE_MS = 30 * 60_000;
const HISTORY_MAX_AGE_MS = 6 * 60 * 60_000;

export interface MarketCache {
  reference: Section<Quote[]> | null;
  history: Record<string, Section<PricePoint[]>>;
  live: Section<Quote[]> | null;
  gold: Section<Quote[]> | null;
  watch: Record<string, Section<Quote | null>>;
}

export const EMPTY_CACHE: MarketCache = { reference: null, history: {}, live: null, gold: null, watch: {} };

export function sanitizeConfig(raw: unknown): MarketsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<MarketsConfig>;
  const currencies = Array.isArray(r.currencies)
    ? [...new Set(r.currencies.filter((c): c is string => typeof c === 'string' && /^[A-Z]{3}$/.test(c)))]
    : DEFAULT_MARKETS_CONFIG.currencies;
  const watchlist = Array.isArray(r.watchlist)
    ? r.watchlist.filter((w): w is WatchItem => !!w && typeof w.symbol === 'string' && typeof w.providerId === 'string')
    : [];
  return { currencies, watchlist };
}

export function watchKey(item: WatchItem): string {
  return `${item.providerId}:${item.symbol}${item.exchange ? `@${item.exchange}` : ''}`;
}

export async function loadMarketCache(): Promise<MarketCache> {
  const raw = await readKey<Partial<MarketCache>>(MARKET_KEYS.cache, {});
  return { ...EMPTY_CACHE, ...raw, history: raw.history ?? {}, watch: raw.watch ?? {} };
}

export async function hasTwelveDataKey(): Promise<boolean> {
  return hasIntegrationKey('twelvedata');
}

/** Kullanıcı entegrasyonu kapattığında bölüme yazılan durum (eski veri gösterilmez). */
function disabledSection<T>(fallback: T): Section<T> {
  return { data: fallback, error: 'DISABLED', fetchedAt: 0 };
}

function stale(section: { fetchedAt: number; error: string | null } | null | undefined, maxAge: number, now: number) {
  return !section || section.error !== null || now - section.fetchedAt >= maxAge;
}

async function section<T>(task: () => Promise<T>, previous: Section<T> | null | undefined, fallback: T): Promise<Section<T>> {
  try {
    return { data: await task(), error: null, fetchedAt: Date.now() };
  } catch (err) {
    const e = toAppError(err);
    if (e.code === 'DISABLED') return disabledSection(fallback);
    // Önceki veriyi koru (eski olduğu zaman damgasından anlaşılır), hatayı işaretle.
    return {
      data: previous?.data ?? fallback,
      error: e.code === 'PROVIDER' || e.code === 'UNKNOWN' ? (e.detail ?? e.code) : e.code,
      fetchedAt: previous?.fetchedAt ?? 0,
    };
  }
}

/** Gram altın (TL) = XAU/USD × USD/TRY ÷ 31,1035 — hesaplanmış değer. */
export function deriveGramGold(ounceUsd: Quote, usdTry: Quote): Quote {
  const price = (ounceUsd.price * usdTry.price) / GRAMS_PER_TROY_OUNCE;
  const prevOunce = ounceUsd.change !== null ? ounceUsd.price - ounceUsd.change : null;
  const prevUsd = usdTry.change !== null ? usdTry.price - usdTry.change : null;
  const prev = prevOunce !== null && prevUsd !== null ? (prevOunce * prevUsd) / GRAMS_PER_TROY_OUNCE : null;
  return {
    key: 'derived:GRAM-ALTIN',
    symbol: 'GRAM/TRY',
    label: 'Gram altın (hesaplanmış)',
    price,
    change: prev !== null ? price - prev : null,
    changePct: prev ? ((price - prev) / prev) * 100 : null,
    currency: 'TRY',
    kind: 'derived',
    providerId: 'derived',
    sourceName: 'XAU/USD × USD/TRY ÷ 31,1035',
    asOf: Math.min(ounceUsd.asOf ?? Date.now(), usdTry.asOf ?? Date.now()),
    fetchedAt: Date.now(),
    note: 'Kuyumcu/banka satış fiyatı değildir',
  };
}

interface RefreshOptions {
  config: MarketsConfig;
  liveMaxAgeMs: number;
  hasKey: boolean;
  force?: boolean;
  /** Ayarlar → Entegrasyonlar durumları; verilmeyen açık sayılır (adaptörler yine de denetler). */
  enabled?: Partial<Record<'tcmb' | 'frankfurter' | 'twelvedata', boolean>>;
}

/**
 * Bölümleri gerektiği kadar yeniler. Her bölüm bağımsızdır: biri başarısız olursa
 * diğerleri etkilenmez ve uygulama çökmez.
 */
export async function refreshMarkets(opts: RefreshOptions): Promise<MarketCache> {
  const now = Date.now();
  const cache = await loadMarketCache();
  const next: MarketCache = { ...cache, history: { ...cache.history }, watch: { ...cache.watch } };
  const liveAge = opts.force ? Math.min(opts.liveMaxAgeMs, 60_000) : opts.liveMaxAgeMs;
  let changed = false;
  const on = { tcmb: true, frankfurter: true, twelvedata: true, ...opts.enabled };

  // 1) TCMB referans kurları
  const refFresh = !stale(cache.reference, REFERENCE_MAX_AGE_MS, now);
  const refHasAll = opts.config.currencies.every((c) => cache.reference?.data.some((q) => q.symbol === `${c}/TRY`));
  if (!on.tcmb) {
    if (cache.reference?.error !== 'DISABLED') {
      next.reference = disabledSection<Quote[]>([]);
      changed = true;
    }
  } else if (!refFresh || !refHasAll || opts.force) {
    next.reference = await section(() => tcmbProvider.getTryRates(opts.config.currencies), cache.reference, []);
    changed = true;
  }

  // 2) 30 günlük referans seri (grafik) — Frankfurter
  for (const code of opts.config.currencies) {
    const key = `${code}/TRY`;
    if (!on.frankfurter) {
      if (cache.history[key]?.error !== 'DISABLED') {
        next.history[key] = disabledSection<PricePoint[]>([]);
        changed = true;
      }
    } else if (stale(cache.history[key], HISTORY_MAX_AGE_MS, now)) {
      next.history[key] = await section(() => frankfurterProvider.getDailySeries(code, 'TRY', 45), cache.history[key], []);
      changed = true;
    }
  }

  // 3) Piyasa fiyatları (anahtar varsa) — Twelve Data. Kapatıldıysa eski fiyatlar da temizlenir.
  if (!on.twelvedata && (next.live || next.gold || Object.keys(next.watch).length > 0)) {
    next.live = null;
    next.gold = null;
    next.watch = {};
    changed = true;
  }
  if (opts.hasKey && on.twelvedata) {
    if (stale(cache.live, liveAge, now)) {
      next.live = await section(
        async () => {
          const pairs = opts.config.currencies.slice(0, 3).map((c) => `${c}/TRY`);
          const results: Quote[] = [];
          for (const symbol of pairs) {
            results.push(await twelveDataProvider.getQuote({ symbol, providerId: 'twelvedata' }));
          }
          return results;
        },
        cache.live,
        [],
      );
      changed = true;
    }
    if (stale(cache.gold, liveAge, now)) {
      next.gold = await section(
        async () => {
          const ounce = await twelveDataProvider.getQuote({ symbol: 'XAU/USD', providerId: 'twelvedata' });
          const usd = next.live?.data.find((q) => q.symbol === 'USD/TRY');
          return usd ? [ounce, deriveGramGold(ounce, usd)] : [ounce];
        },
        cache.gold,
        [],
      );
      changed = true;
    }
    for (const item of opts.config.watchlist) {
      const key = watchKey(item);
      if (stale(cache.watch[key], liveAge, now)) {
        next.watch[key] = await section(() => twelveDataProvider.getQuote(item), cache.watch[key], null);
        changed = true;
      }
    }
  }

  // Listeden çıkarılanları temizle.
  const keys = new Set(opts.config.watchlist.map(watchKey));
  for (const k of Object.keys(next.watch)) if (!keys.has(k)) delete next.watch[k];

  if (changed) await writeKey(MARKET_KEYS.cache, next);
  return next;
}
