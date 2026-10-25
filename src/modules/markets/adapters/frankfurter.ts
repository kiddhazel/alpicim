import { netGetOk } from '../../../shared/lib/net';
import { isoDate } from '../../../shared/lib/time';
import { AppError } from '../../../shared/lib/tauri';
import { assertIntegrationEnabled } from '../../integrations/integrationsService';
import type { PricePoint } from '../types';
import { toNumber, type HistoryProvider, type ProviderInfo } from './provider';

/**
 * Frankfurter: Avrupa Merkez Bankası ve diğer resmî kaynaklardan günlük referans kurlar.
 * Anahtar gerektirmez. Grafiklerdeki 30 günlük seri için kullanılır.
 */
export const FRANKFURTER_INFO: ProviderInfo = {
  id: 'frankfurter',
  name: 'Frankfurter',
  homepage: 'https://frankfurter.dev',
  requiresKey: false,
  description: 'Merkez bankası referans kurlarından günlük seri (iş günleri).',
  terms: 'Ücretsiz, açık kaynak API. Günlük veri; anlık değildir.',
};

const BASE = 'https://api.frankfurter.dev/v1';

interface SeriesResponse {
  rates?: Record<string, Record<string, number>>;
}

export function parseSeries(json: string, quote: string): PricePoint[] {
  let data: SeriesResponse;
  try {
    data = JSON.parse(json) as SeriesResponse;
  } catch {
    throw new AppError('PARSE', 'Frankfurter yanıtı okunamadı');
  }
  return Object.entries(data.rates ?? {})
    .map(([day, rates]) => ({ t: day, v: toNumber(rates[quote]) }))
    .filter((p): p is PricePoint => p.v !== null)
    .sort((a, b) => a.t.localeCompare(b.t));
}

export const frankfurterProvider: HistoryProvider = {
  info: FRANKFURTER_INFO,
  async getDailySeries(base, quote, days) {
    await assertIntegrationEnabled('frankfurter');
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    const url = `${BASE}/${isoDate(start)}..${isoDate(end)}?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`;
    const res = await netGetOk({ url });
    return parseSeries(res.body, quote);
  },
};
