import type { PricePoint, Quote } from '../types';
import type { ProviderInfo } from './provider';

/**
 * Yalnızca arayüzü denemek için örnek veri. Her değer `kind: 'demo'` taşır ve arayüzde
 * belirgin "DEMO" etiketiyle gösterilir. Ayarlardan açıkça etkinleştirilmedikçe kullanılmaz.
 */
export const DEMO_INFO: ProviderInfo = {
  id: 'demo',
  name: 'DEMO',
  homepage: '',
  requiresKey: false,
  description: 'Örnek veri — gerçek piyasa verisi DEĞİLDİR.',
  terms: 'Sabit tohumdan üretilir.',
};

/** Deterministik sözde rastgele (aynı gün aynı seri). */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function demoSeries(start: number, points: number, seed: number): PricePoint[] {
  const rnd = seeded(seed);
  const out: PricePoint[] = [];
  let v = start;
  for (let i = points - 1; i >= 0; i--) {
    v *= 1 + (rnd() - 0.48) * 0.01;
    out.push({ t: `D-${i}`, v: Number(v.toFixed(4)) });
  }
  return out;
}

export function demoQuotes(): Array<{ quote: Quote; series: PricePoint[] }> {
  const now = Date.now();
  const defs = [
    { symbol: 'USD/TRY', label: 'Örnek dolar', base: 40, currency: 'TRY', seed: 11 },
    { symbol: 'XAU/USD', label: 'Örnek ons altın', base: 2400, currency: 'USD', seed: 23 },
    { symbol: 'ORNEK', label: 'Örnek hisse', base: 120, currency: 'TRY', seed: 37 },
  ];
  return defs.map((d) => {
    const series = demoSeries(d.base, 30, d.seed);
    const last = series[series.length - 1]?.v ?? d.base;
    const prev = series[series.length - 2]?.v ?? last;
    return {
      series,
      quote: {
        key: `demo:${d.symbol}`,
        symbol: d.symbol,
        label: d.label,
        price: last,
        change: last - prev,
        changePct: ((last - prev) / prev) * 100,
        currency: d.currency,
        kind: 'demo',
        providerId: DEMO_INFO.id,
        sourceName: 'DEMO',
        asOf: null,
        fetchedAt: now,
        note: 'Gerçek veri değildir',
      },
    };
  });
}
