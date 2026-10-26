import type { AchievementState, BadgeId } from '../achievements/achievements';

/** Laila'nın odası (saf mantık): eşya açılma kuralları ve yerleşim. */

export const ROOM_KEY = 'room.layout';
export const BOND_KEY = 'laila.bond';

export type FurnitureId = 'rug' | 'bed' | 'plant' | 'lamp' | 'poster' | 'bookshelf' | 'aquarium' | 'gamingpc';

export interface FurnitureDef {
  id: FurnitureId;
  /** Bağ puanıyla açılır. */
  points?: number;
  /** Rozetle açılır. */
  badge?: BadgeId;
}

export const FURNITURE: readonly FurnitureDef[] = [
  { id: 'rug' },
  { id: 'bed', points: 10 },
  { id: 'plant', points: 40 },
  { id: 'aquarium', points: 100 },
  { id: 'lamp', badge: 'pomodoro10' },
  { id: 'bookshelf', badge: 'news100' },
  { id: 'poster', badge: 'wordle' },
  { id: 'gamingpc', badge: 'player10' },
];

export interface RoomLayout {
  /** Kullanıcının kaldırdığı (gizlediği) eşyalar; açık olan her şey varsayılan olarak yerleşiktir. */
  hidden: FurnitureId[];
}

const IDS = new Set<string>(FURNITURE.map((f) => f.id));

export function sanitizeRoom(raw: unknown): RoomLayout {
  const hidden = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).hidden : null;
  if (!Array.isArray(hidden)) return { hidden: [] };
  return { hidden: [...new Set(hidden.filter((h): h is FurnitureId => typeof h === 'string' && IDS.has(h)))] };
}

/** Bağ kaydından yalnız puanı okur (bozuksa 0). */
export function bondPoints(raw: unknown): number {
  if (typeof raw !== 'object' || raw === null) return 0;
  const p = (raw as Record<string, unknown>).points;
  return typeof p === 'number' && Number.isFinite(p) ? Math.max(0, Math.floor(p)) : 0;
}

export function isUnlocked(def: FurnitureDef, points: number, achievements: AchievementState): boolean {
  if (def.points !== undefined) return points >= def.points;
  if (def.badge !== undefined) return achievements.unlocked[def.badge] !== undefined;
  return true;
}

export function unlockedFurniture(points: number, achievements: AchievementState): FurnitureId[] {
  return FURNITURE.filter((f) => isUnlocked(f, points, achievements)).map((f) => f.id);
}

/** Odada çizilecek eşyalar: açık ve gizlenmemiş olanlar. */
export function placedFurniture(points: number, achievements: AchievementState, layout: RoomLayout): FurnitureId[] {
  return unlockedFurniture(points, achievements).filter((id) => !layout.hidden.includes(id));
}

export function toggleFurniture(layout: RoomLayout, id: FurnitureId): RoomLayout {
  return layout.hidden.includes(id) ? { hidden: layout.hidden.filter((h) => h !== id) } : { hidden: [...layout.hidden, id] };
}

export type Daypart = 'dawn' | 'day' | 'sunset' | 'night';

export function daypartFrom(value: string | undefined): Daypart {
  return value === 'dawn' || value === 'sunset' || value === 'night' ? value : 'day';
}
