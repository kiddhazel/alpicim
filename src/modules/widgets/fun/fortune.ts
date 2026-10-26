import { obj } from '../types';

/** Şans kurabiyesi: günde bir kez açılır; bugünkü kurabiyenin dizini saklanır. */
export interface FortuneState {
  /** YYYY-MM-DD (yerel gün). */
  day: string;
  /** Kurabiye metninin dizini (`lines` listesinde). */
  index: number;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bugün için kurabiye seçer. `rnd` [0, 1) aralığında bir sayıdır (varsayılan: rastgele; testte sabit verilir).
 * `count` 0 veya daha küçükse dizin 0 döner.
 */
export function fortuneForDay(dayKey: string, count: number, rnd: number = Math.random()): FortuneState {
  if (count < 1 || !Number.isFinite(rnd)) return { day: dayKey, index: 0 };
  const clamped = Math.min(Math.max(rnd, 0), 0.999999999);
  return { day: dayKey, index: Math.floor(clamped * count) };
}

/** Kalıcı kaydı doğrular; bozuksa `null` döner. */
export function sanitizeFortune(raw: unknown): FortuneState | null {
  const r = obj(raw);
  if (typeof r.day !== 'string' || !DAY_KEY.test(r.day)) return null;
  if (typeof r.index !== 'number' || !Number.isInteger(r.index) || r.index < 0) return null;
  return { day: r.day, index: r.index };
}
