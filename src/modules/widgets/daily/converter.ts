import type { Quote } from '../../markets/types';
import { obj, str } from '../types';

/** Döviz çevirici: TCMB gösterge kurlarıyla (TRY karşılığı) çapraz çeviri. */
export interface ConverterConfig {
  /** Kullanıcının yazdığı tutar (ham metin; "1.250,50" gibi). */
  amount: string;
  from: string;
  to: string;
}

export const converterDefaults: ConverterConfig = { amount: '100', from: 'USD', to: 'TRY' };

const CODE_RE = /^[A-Z]{3}$/;

export function sanitizeConverter(raw: unknown): ConverterConfig {
  const r = obj(raw);
  const code = (v: unknown, d: string) => (typeof v === 'string' && CODE_RE.test(v) ? v : d);
  return { amount: str(r.amount, converterDefaults.amount, 24), from: code(r.from, 'USD'), to: code(r.to, 'TRY') };
}

/**
 * Referans (TCMB) kotasyonlarından "1 birim = x TRY" tablosu. Yalnızca `reference` türü ve TRY fiyatlı
 * kayıtlar kullanılır; piyasa/demo verisi karıştırılmaz. TRY her zaman 1'dir.
 */
export function ratesFromQuotes(quotes: readonly Quote[]): Map<string, number> {
  const rates = new Map<string, number>();
  for (const q of quotes) {
    if (q.kind !== 'reference' || q.currency !== 'TRY' || !(q.price > 0)) continue;
    const [code, quote] = q.symbol.split('/');
    if (quote === 'TRY' && code && CODE_RE.test(code)) rates.set(code, q.price);
  }
  if (rates.size > 0) rates.set('TRY', 1);
  return rates;
}

export function convert(amount: number, from: string, to: string, rates: ReadonlyMap<string, number>): number | null {
  const a = rates.get(from);
  const b = rates.get(to);
  if (a === undefined || b === undefined || !Number.isFinite(amount)) return null;
  return (amount * a) / b;
}

/**
 * Türkçe veya İngilizce yazılmış tutarı sayıya çevirir: "1.234,56", "1234.56", "1 234,5", "1,5".
 * Negatif, boş veya geçersizse null.
 */
export function parseAmount(text: string): number | null {
  const s = text.replace(/[\s₺$€£]/g, '');
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastDot !== -1 && lastComma !== -1) {
    // Sondaki ayırıcı ondalıktır; diğeri binlik.
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    normalized = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma !== -1) {
    normalized = /^\d{1,3}(,\d{3}){2,}$/.test(s) ? s.split(',').join('') : s.replace(',', '.');
  } else if (lastDot !== -1) {
    normalized = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.split('.').join('') : s;
  } else {
    normalized = s;
  }
  if ((normalized.match(/\./g) ?? []).length > 1) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
