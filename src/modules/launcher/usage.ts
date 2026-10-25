/** Başlatıcı kullanım istatistiği: saf işlevler + doğrulama. Depo anahtarı: `launcher.usage`. */

export const USAGE_KEY = 'launcher.usage';
const MAX_ENTRIES = 300;

export interface UsageEntry {
  count: number;
  lastAt: number;
}
export type UsageMap = Record<string, UsageEntry>;

export const EMPTY_USAGE: UsageMap = {};

export function sanitizeUsage(raw: unknown): UsageMap {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: UsageMap = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || typeof v !== 'object' || v === null) continue;
    const { count, lastAt } = v as Record<string, unknown>;
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) continue;
    if (typeof lastAt !== 'number' || !Number.isFinite(lastAt) || lastAt < 0) continue;
    out[id] = { count: Math.floor(count), lastAt };
  }
  return out;
}

/** Bir başlatmayı kaydeder; kayıt sayısı sınırı aşarsa en eski kullanılanlar atılır. */
export function recordLaunch(usage: UsageMap, id: string, now: number): UsageMap {
  const prev = usage[id];
  const next: UsageMap = { ...usage, [id]: { count: (prev?.count ?? 0) + 1, lastAt: now } };
  const ids = Object.keys(next);
  if (ids.length <= MAX_ENTRIES) return next;
  const keep = ids.sort((a, b) => (next[b]?.lastAt ?? 0) - (next[a]?.lastAt ?? 0)).slice(0, MAX_ENTRIES);
  return Object.fromEntries(keep.map((k) => [k, next[k] as UsageEntry]));
}

/** Yalnızca geçerli kimlikler arasından, en son kullanılan `n` kimlik. */
export function recentIds(usage: UsageMap, validIds: readonly string[], n: number): string[] {
  return validIds
    .filter((id) => usage[id])
    .sort((a, b) => (usage[b]?.lastAt ?? 0) - (usage[a]?.lastAt ?? 0))
    .slice(0, n);
}

/** Yalnızca geçerli kimlikler arasından, en çok kullanılan `n` kimlik (eşitlikte en yeni önce). */
export function topIds(usage: UsageMap, validIds: readonly string[], n: number): string[] {
  return validIds
    .filter((id) => usage[id])
    .sort((a, b) => {
      const d = (usage[b]?.count ?? 0) - (usage[a]?.count ?? 0);
      return d !== 0 ? d : (usage[b]?.lastAt ?? 0) - (usage[a]?.lastAt ?? 0);
    })
    .slice(0, n);
}
