import { normalizeText } from '../palette/palette';

/** Rust → clipboard.rs (`ClipEntry`, `ClipSnapshot`). */
export interface ClipEntry {
  id: string;
  text: string;
  /** Son kopyalanma zamanı (ms). */
  at: number;
  pinned: boolean;
}

export interface ClipSnapshot {
  entries: ClipEntry[];
  paused: boolean;
  available: boolean;
}

export const EMPTY_SNAPSHOT: ClipSnapshot = { entries: [], paused: false, available: false };

/** Rust'tan gelen veriyi doğrular (bozuk kayıtlar atlanır). */
export function sanitizeSnapshot(raw: unknown): ClipSnapshot {
  if (!raw || typeof raw !== 'object') return EMPTY_SNAPSHOT;
  const r = raw as Record<string, unknown>;
  const entries = Array.isArray(r.entries)
    ? r.entries.filter(
        (e): e is ClipEntry =>
          !!e && typeof e === 'object' && typeof (e as ClipEntry).id === 'string' && typeof (e as ClipEntry).text === 'string',
      ).map((e) => ({ id: e.id, text: e.text, at: typeof e.at === 'number' ? e.at : 0, pinned: e.pinned === true }))
    : [];
  return { entries, paused: r.paused === true, available: r.available === true };
}

/** Arama (aksan/büyük-küçük harf duyarsız, tüm sözcükler) + sabitlenenler önce, sonra en yeni. */
export function filterClips(entries: readonly ClipEntry[], query: string): { pinned: ClipEntry[]; recent: ClipEntry[] } {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  const match = (e: ClipEntry) => {
    if (words.length === 0) return true;
    const hay = normalizeText(e.text);
    return words.every((w) => hay.includes(w));
  };
  const list = entries.filter(match).sort((a, b) => b.at - a.at);
  return { pinned: list.filter((e) => e.pinned), recent: list.filter((e) => !e.pinned) };
}

/** Tek satırlık önizleme: boşluklar sadeleşir, en çok `max` karakter. */
export function clipPreview(text: string, max = 280): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function lineCount(text: string): number {
  return text.split(/\r\n|\r|\n/).length;
}

/** Metnin tamamı tek bir http(s) adresiyse adresi döner. */
export function clipUrl(text: string): string | null {
  const s = text.trim();
  if (!/^https?:\/\/\S+$/i.test(s)) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}
