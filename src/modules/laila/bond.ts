import { OUTFITS, isOutfitId, outfitDef, type OutfitId } from './sprite';

/** Laila ile bağ: puan, günlük ziyaret serisi, açılan kıyafetler (saf mantık). */

export const BOND_KEY = 'laila.bond';
export const DAILY_VISIT_POINTS = 3;
export const PET_POINTS = 1;
export const MAX_PET_POINTS_PER_DAY = 20;
/** Bağ seviyesi eşikleri (puan). */
export const LEVEL_THRESHOLDS: readonly number[] = [0, 10, 40, 100, 200];

export interface Bond {
  points: number;
  /** Son ziyaret günü (yerel, YYYY-MM-DD). */
  lastVisitDay: string;
  streakDays: number;
  /** lastVisitDay günü okşamadan kazanılan puan. */
  todayPets: number;
  outfit: OutfitId;
}

export const DEFAULT_BOND: Bond = { points: 0, lastVisitDay: '', streakDays: 0, todayPets: 0, outfit: 'default' };

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return '';
  return dayKey(new Date(y, m - 1, d - 1));
}

export function sanitizeBond(raw: unknown): Bond {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_BOND };
  const r = raw as Record<string, unknown>;
  const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.floor(v))) : 0);
  const points = int(r.points, 1_000_000);
  let outfit: OutfitId = isOutfitId(r.outfit) ? r.outfit : 'default';
  if (outfitDef(outfit).points > points) outfit = 'default';
  return {
    points,
    lastVisitDay: typeof r.lastVisitDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.lastVisitDay) ? r.lastVisitDay : '',
    streakDays: int(r.streakDays, 100_000),
    todayPets: int(r.todayPets, MAX_PET_POINTS_PER_DAY),
    outfit,
  };
}

export interface BondChange {
  bond: Bond;
  gained: number;
  /** Günün ilk ziyareti mi? */
  newDay: boolean;
}

/** Günün ilk ziyareti: +3 puan, seri güncellenir. */
export function registerVisit(b: Bond, today: string): BondChange {
  if (b.lastVisitDay === today) return { bond: b, gained: 0, newDay: false };
  const streakDays = b.lastVisitDay && b.lastVisitDay === previousDay(today) ? b.streakDays + 1 : 1;
  return {
    bond: { ...b, points: b.points + DAILY_VISIT_POINTS, lastVisitDay: today, streakDays, todayPets: 0 },
    gained: DAILY_VISIT_POINTS,
    newDay: true,
  };
}

/** Tıklama/okşama: +1 puan, günde en çok 20. */
export function pet(b: Bond, today: string): BondChange {
  const visit = registerVisit(b, today);
  const cur = visit.bond;
  if (cur.todayPets >= MAX_PET_POINTS_PER_DAY) return { bond: cur, gained: visit.gained, newDay: visit.newDay };
  return {
    bond: { ...cur, points: cur.points + PET_POINTS, todayPets: cur.todayPets + 1 },
    gained: visit.gained + PET_POINTS,
    newDay: visit.newDay,
  };
}

export function levelOf(points: number): { index: number; next: number | null } {
  let index = 0;
  LEVEL_THRESHOLDS.forEach((min, i) => {
    if (points >= min) index = i;
  });
  return { index, next: LEVEL_THRESHOLDS[index + 1] ?? null };
}

/** Önceki ve yeni puan arasında yeni açılan kıyafetler. */
export function newlyUnlocked(prev: number, next: number): OutfitId[] {
  return OUTFITS.filter((o) => o.points > prev && o.points <= next).map((o) => o.id);
}

export function selectOutfit(b: Bond, id: OutfitId): Bond {
  return outfitDef(id).points <= b.points ? { ...b, outfit: id } : b;
}
