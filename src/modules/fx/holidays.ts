/** Özel günler (saf): tarih → tema. Hicri bayramlar sabit tablo (yaklaşık; Diyanet takvimine göre güncellenmeli). */

export type HolidayId =
  | 'newYear'
  | 'valentine'
  | 'ramadan'
  | 'kurban'
  | 'children' // 23 Nisan
  | 'halloween'
  | 'republic' // 29 Ekim
  | 'christmas';

/** [ay (1-12), gün] aralığı, iki uç dahil; yıl dönümü aşan aralık (ör. 20 Ara – 2 Oca) desteklenir. */
type Span = readonly [from: readonly [number, number], to: readonly [number, number]];

const FIXED: readonly [HolidayId, Span][] = [
  ['newYear', [[12, 30], [1, 2]]],
  ['christmas', [[12, 20], [12, 29]]],
  ['valentine', [[2, 12], [2, 15]]],
  ['children', [[4, 22], [4, 23]]],
  ['republic', [[10, 28], [10, 29]]],
  ['halloween', [[10, 24], [11, 1]]],
];

/** Yıl → [başlangıç ay, gün, gün sayısı]. */
const LUNAR: Record<number, readonly [HolidayId, number, number, number][]> = {
  2026: [['ramadan', 3, 20, 3], ['kurban', 5, 27, 4]],
  2027: [['ramadan', 3, 9, 3], ['kurban', 5, 16, 4]],
  2028: [['ramadan', 2, 26, 3], ['kurban', 5, 5, 4]],
};

const key = (m: number, d: number) => m * 100 + d;

function inSpan(date: Date, [[fm, fd], [tm, td]]: Span): boolean {
  const k = key(date.getMonth() + 1, date.getDate());
  const from = key(fm, fd);
  const to = key(tm, td);
  return from <= to ? k >= from && k <= to : k >= from || k <= to;
}

/** O gün geçerli özel gün; çakışmada listedeki ilk (29 Ekim, cadılar bayramından önce gelir). */
export function currentHoliday(date: Date = new Date()): HolidayId | null {
  const y = date.getFullYear();
  for (const [id, m, d, days] of LUNAR[y] ?? []) {
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + days - 1, 23, 59, 59);
    if (date >= start && date <= end) return id;
  }
  const republic = FIXED.find(([id]) => id === 'republic');
  if (republic && inSpan(date, republic[1])) return 'republic';
  for (const [id, span] of FIXED) if (inSpan(date, span)) return id;
  return null;
}
