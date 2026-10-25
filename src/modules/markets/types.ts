/**
 * Veri türü — kullanıcıya her fiyatın yanında gösterilir; birbirine karıştırılmaz.
 * - reference: Merkez bankası gösterge/referans kuru (günlük, işlem yapılabilir fiyat değildir)
 * - market:    Piyasa fiyatı (sağlayıcı ve plana göre gecikmeli olabilir)
 * - derived:   Başka fiyatlardan hesaplanmış değer (ör. gram altın TL)
 * - demo:      Örnek veri — gerçek değildir
 */
export type DataKind = 'reference' | 'market' | 'derived' | 'demo';

export interface PricePoint {
  /** ISO tarih/zaman */
  t: string;
  v: number;
}

export interface Quote {
  /** Benzersiz anahtar, ör. "tcmb:USD", "twelvedata:XAU/USD" */
  key: string;
  symbol: string;
  label: string;
  price: number;
  change: number | null;
  changePct: number | null;
  /** Fiyatın para birimi (TRY, USD ...) */
  currency: string;
  kind: DataKind;
  providerId: string;
  sourceName: string;
  /** Sağlayıcının bildirdiği veri zamanı (ms) */
  asOf: number | null;
  /** Bizim çektiğimiz zaman (ms) */
  fetchedAt: number;
  note?: string;
}

export interface WatchItem {
  /** Sağlayıcı sembolü, ör. "AAPL", "THYAO", "BTC/USD" */
  symbol: string;
  /** İsteğe bağlı borsa/MIC kodu, ör. "XIST", "NASDAQ" */
  exchange?: string;
  /** Doğrulama sırasında sağlayıcıdan alınan ad */
  name?: string;
  providerId: string;
}

export interface MarketsConfig {
  /** TRY karşısında izlenen para birimleri (TCMB kodları) */
  currencies: string[];
  watchlist: WatchItem[];
}

export const DEFAULT_MARKETS_CONFIG: MarketsConfig = {
  currencies: ['USD', 'EUR', 'GBP'],
  watchlist: [],
};

/** Bir bölüm için sonuç: veriler ya da hata kodu. */
export interface Section<T> {
  data: T;
  error: string | null;
  fetchedAt: number;
}
