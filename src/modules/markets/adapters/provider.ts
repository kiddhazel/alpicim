import type { PricePoint, Quote, WatchItem } from '../types';

/** Tüm sağlayıcıların ortak kimlik bilgisi. */
export interface ProviderInfo {
  id: string;
  name: string;
  homepage: string;
  requiresKey: boolean;
  /** Kullanıcıya gösterilen kısa açıklama (veri türü, güncellenme sıklığı). */
  description: string;
  /** Kullanım koşulları / sınırlar hakkında not. */
  terms: string;
}

/** TRY karşısında referans kur veren sağlayıcı (ör. TCMB). */
export interface ReferenceFxProvider {
  info: ProviderInfo;
  getTryRates(codes: readonly string[]): Promise<Quote[]>;
  /** Sağlayıcının desteklediği para birimi kodları. */
  listCurrencies(): Promise<string[]>;
}

/** Geçmiş günlük kur serisi veren sağlayıcı (grafikler için). */
export interface HistoryProvider {
  info: ProviderInfo;
  getDailySeries(base: string, quote: string, days: number): Promise<PricePoint[]>;
}

export interface SymbolValidation {
  ok: boolean;
  name?: string;
  exchange?: string;
  /** Sağlayıcının hata mesajı (olduğu gibi gösterilir). */
  message?: string;
}

/** Piyasa fiyatı (döviz, emtia, hisse) veren sağlayıcı. */
export interface MarketQuoteProvider {
  info: ProviderInfo;
  getQuote(item: WatchItem): Promise<Quote>;
  getDailySeries(item: WatchItem, points: number): Promise<PricePoint[]>;
  validateSymbol(item: WatchItem): Promise<SymbolValidation>;
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}
