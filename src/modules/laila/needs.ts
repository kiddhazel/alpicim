/** Laila'nın ihtiyaçları (Tamagotchi-lite): asla cezalandırıcı değil — değerler 8'in altına inmez. */

export const NEEDS_KEY = 'laila.needs';
export const NEEDS_FLOOR = 8;
/** Uygulama kapalıyken en çok bu kadar saatlik azalma uygulanır. */
export const MAX_OFFLINE_HOURS = 8;
/** Saat başına azalma. */
export const DECAY_PER_HOUR = { hunger: 4, fun: 3, energy: 2 } as const;
export const LOW = 25;

export type SnackId = 'strawberry' | 'cookie' | 'tea';
export type Mood = 'ok' | 'sleepy' | 'hungry' | 'bored';

export interface Snack {
  id: SnackId;
  hunger: number;
  fun: number;
  energy: number;
  cooldownMs: number;
}

export const SNACKS: readonly Snack[] = [
  { id: 'strawberry', hunger: 15, fun: 3, energy: 0, cooldownMs: 60_000 },
  { id: 'cookie', hunger: 25, fun: 5, energy: 0, cooldownMs: 120_000 },
  { id: 'tea', hunger: 8, fun: 0, energy: 12, cooldownMs: 90_000 },
];

export interface Needs {
  hunger: number;
  fun: number;
  energy: number;
  /** Son güncelleme (ms). */
  updatedAt: number;
  /** Son ikram zamanları (bekleme süresi için). */
  fedAt: Partial<Record<SnackId, number>>;
}

export function defaultNeeds(now: number): Needs {
  return { hunger: 80, fun: 80, energy: 90, updatedAt: now, fedAt: {} };
}

const clamp = (v: number) => Math.min(100, Math.max(0, v));

export function sanitizeNeeds(raw: unknown, now = Date.now()): Needs {
  const d = defaultNeeds(now);
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, fb: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v) : fb);
  const fedAt: Needs['fedAt'] = {};
  if (typeof r.fedAt === 'object' && r.fedAt !== null) {
    for (const s of SNACKS) {
      const v = (r.fedAt as Record<string, unknown>)[s.id];
      if (typeof v === 'number' && Number.isFinite(v)) fedAt[s.id] = v;
    }
  }
  return {
    hunger: num(r.hunger, d.hunger),
    fun: num(r.fun, d.fun),
    energy: num(r.energy, d.energy),
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? Math.min(r.updatedAt, now) : now,
    fedAt,
  };
}

/** Geçen gerçek zamana göre azalt (yukarıda belirtilen tavan ve taban ile). */
export function applyDecay(n: Needs, now: number): Needs {
  const hours = Math.min(MAX_OFFLINE_HOURS, Math.max(0, (now - n.updatedAt) / 3_600_000));
  const down = (v: number, rate: number) => (v <= NEEDS_FLOOR ? v : Math.max(NEEDS_FLOOR, v - rate * hours));
  return {
    ...n,
    hunger: down(n.hunger, DECAY_PER_HOUR.hunger),
    fun: down(n.fun, DECAY_PER_HOUR.fun),
    energy: down(n.energy, DECAY_PER_HOUR.energy),
    updatedAt: now,
  };
}

export function adjust(n: Needs, d: Partial<Pick<Needs, 'hunger' | 'fun' | 'energy'>>): Needs {
  return {
    ...n,
    hunger: clamp(n.hunger + (d.hunger ?? 0)),
    fun: clamp(n.fun + (d.fun ?? 0)),
    energy: clamp(n.energy + (d.energy ?? 0)),
  };
}

export function snackReadyIn(n: Needs, id: SnackId, now: number): number {
  const snack = SNACKS.find((s) => s.id === id);
  const at = n.fedAt[id];
  if (!snack || at === undefined) return 0;
  return Math.max(0, at + snack.cooldownMs - now);
}

/** İkram ver: bekleme süresi dolmadıysa aynı nesne döner. */
export function feed(n: Needs, id: SnackId, now: number): Needs {
  const snack = SNACKS.find((s) => s.id === id);
  if (!snack || snackReadyIn(n, id, now) > 0) return n;
  const next = adjust(n, { hunger: snack.hunger, fun: snack.fun, energy: snack.energy });
  return { ...next, fedAt: { ...n.fedAt, [id]: now } };
}

/** En baskın ihtiyaç durumu (yalnız belirgin düşüklükte). */
export function moodOf(n: Needs): Mood {
  const lowest = Math.min(n.hunger, n.fun, n.energy);
  if (lowest >= LOW) return 'ok';
  if (n.energy === lowest) return 'sleepy';
  if (n.hunger === lowest) return 'hungry';
  return 'bored';
}
