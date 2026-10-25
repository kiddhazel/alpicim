import { XMLParser } from 'fast-xml-parser';
import { netGet, netGetOk } from '../../../shared/lib/net';
import { AppError } from '../../../shared/lib/tauri';
import { assertIntegrationEnabled } from '../../integrations/integrationsService';
import type { Quote } from '../types';
import { toNumber, type ProviderInfo, type ReferenceFxProvider } from './provider';

/**
 * TCMB gösterge niteliğindeki döviz kurları (today.xml).
 * İş günlerinde 15:30'da yayımlanır; hafta sonu/tatilde son yayımlanan bülten döner.
 * Bunlar piyasa (işlem) fiyatı değildir — "referans" olarak etiketlenir.
 */
export const TCMB_INFO: ProviderInfo = {
  id: 'tcmb',
  name: 'TCMB',
  homepage: 'https://www.tcmb.gov.tr/kurlar/kurlar_tr.html',
  requiresKey: false,
  description: 'Türkiye Cumhuriyet Merkez Bankası gösterge niteliğindeki kurlar (iş günü 15:30).',
  terms: 'Kamuya açık veri. Gösterge niteliğindedir; alım-satım fiyatı değildir.',
};

const TODAY_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  isArray: (name) => name === 'Currency',
});

export interface TcmbRate {
  code: string;
  name: string;
  unit: number;
  forexBuying: number | null;
  forexSelling: number | null;
  banknoteSelling: number | null;
}

export interface TcmbBulletin {
  /** Bülten tarihi, "DD.MM.YYYY" */
  date: string;
  /** Bülten zamanı (yerel 15:30) ms */
  publishedAt: number | null;
  rates: Map<string, TcmbRate>;
}

/** TCMB XML bültenini ayrıştırır. */
export function parseTcmbXml(xml: string): TcmbBulletin {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = doc.Tarih_Date as Record<string, unknown> | undefined;
  if (!root) throw new AppError('PARSE', 'TCMB yanıtı beklenen biçimde değil');
  const date = String(root['@_Tarih'] ?? '');
  const currencies = (root.Currency as Array<Record<string, unknown>> | undefined) ?? [];
  const rates = new Map<string, TcmbRate>();
  for (const c of currencies) {
    const code = String(c['@_CurrencyCode'] ?? c['@_Kod'] ?? '').toUpperCase();
    if (!code) continue;
    rates.set(code, {
      code,
      name: String(c.Isim ?? code),
      unit: toNumber(c.Unit) ?? 1,
      forexBuying: toNumber(c.ForexBuying),
      forexSelling: toNumber(c.ForexSelling),
      banknoteSelling: toNumber(c.BanknoteSelling),
    });
  }
  return { date, publishedAt: bulletinTime(date), rates };
}

/** "23.10.2026" → o gün 15:30 (Türkiye, UTC+3) */
export function bulletinTime(date: string): number | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date);
  if (!m) return null;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 30);
}

/** Bir önceki iş gününün arşiv adresi: /kurlar/YYYYMM/DDMMYYYY.xml */
export function archiveUrl(day: Date): string {
  const dd = String(day.getUTCDate()).padStart(2, '0');
  const mm = String(day.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = day.getUTCFullYear();
  return `https://www.tcmb.gov.tr/kurlar/${yyyy}${mm}/${dd}${mm}${yyyy}.xml`;
}

function perUnit(rate: TcmbRate): number | null {
  const v = rate.forexSelling ?? rate.banknoteSelling;
  return v === null ? null : v / (rate.unit || 1);
}

// Önceki bülten günde bir kez değişir; oturum boyunca bellekte tut.
const previousCache = new Map<string, TcmbBulletin | null>();

async function previousBulletin(current: TcmbBulletin): Promise<TcmbBulletin | null> {
  if (previousCache.has(current.date)) return previousCache.get(current.date) ?? null;
  const base = current.publishedAt ? new Date(current.publishedAt) : new Date();
  let found: TcmbBulletin | null = null;
  // Tatil/hafta sonu olabilir: en fazla 6 gün geriye git.
  for (let back = 1; back <= 6 && !found; back++) {
    const day = new Date(base.getTime() - back * 86_400_000);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const res = await netGet({ url: archiveUrl(day) }).catch(() => null);
    if (res?.ok && res.body.includes('Tarih_Date')) {
      try {
        found = parseTcmbXml(res.body);
      } catch {
        /* sonraki günü dene */
      }
    }
  }
  previousCache.set(current.date, found);
  return found;
}

export const tcmbProvider: ReferenceFxProvider & { getBulletin(): Promise<TcmbBulletin> } = {
  info: TCMB_INFO,

  async getBulletin() {
    await assertIntegrationEnabled('tcmb');
    const res = await netGetOk({ url: TODAY_URL });
    return parseTcmbXml(res.body);
  },

  async listCurrencies() {
    const b = await this.getBulletin();
    return [...b.rates.keys()].filter((c) => c !== 'XDR');
  },

  async getTryRates(codes) {
    const current = await this.getBulletin();
    const previous = await previousBulletin(current);
    const now = Date.now();
    const quotes: Quote[] = [];
    for (const code of codes) {
      const rate = current.rates.get(code);
      const price = rate ? perUnit(rate) : null;
      if (!rate || price === null) continue;
      const prevRate = previous?.rates.get(code);
      const prev = prevRate ? perUnit(prevRate) : null;
      const change = prev !== null ? price - prev : null;
      quotes.push({
        key: `tcmb:${code}`,
        symbol: `${code}/TRY`,
        label: rate.name,
        price,
        change,
        changePct: change !== null && prev ? (change / prev) * 100 : null,
        currency: 'TRY',
        kind: 'reference',
        providerId: TCMB_INFO.id,
        sourceName: 'TCMB',
        asOf: current.publishedAt,
        fetchedAt: now,
        note: previous ? `Döviz satış · önceki bülten ${previous.date}` : 'Döviz satış',
      });
    }
    return quotes;
  },
};
