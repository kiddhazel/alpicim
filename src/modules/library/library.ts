/** Oyun kütüphanesi: saf mantık (süzme, favoriler, son oynanan, rastgele seçim). */

export type GameStore = 'steam' | 'epic' | 'riot';

/** Rust → GameView */
export interface LibraryGame {
  id: string;
  name: string;
  store: GameStore;
  /** Yalnız Steam: kapak görseli için. */
  appId: number | null;
  hasIcon: boolean;
}

export const LIBRARY_KEY = 'library';

export interface LibraryState {
  favorites: string[];
  /** oyun kimliği → son başlatma (Unix ms) */
  lastPlayed: Record<string, number>;
}

export const DEFAULT_LIBRARY: LibraryState = { favorites: [], lastPlayed: {} };

export function sanitizeLibrary(raw: unknown): LibraryState {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const favorites = Array.isArray(r.favorites)
    ? [...new Set(r.favorites.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 80))].slice(0, 500)
    : [];
  const lastPlayed: Record<string, number> = {};
  if (r.lastPlayed && typeof r.lastPlayed === 'object' && !Array.isArray(r.lastPlayed)) {
    for (const [k, v] of Object.entries(r.lastPlayed as Record<string, unknown>)) {
      if (k.length < 80 && typeof v === 'number' && Number.isFinite(v) && v > 0) lastPlayed[k] = v;
    }
  }
  return { favorites, lastPlayed };
}

export function toggleFavorite(state: LibraryState, id: string): LibraryState {
  const has = state.favorites.includes(id);
  return { ...state, favorites: has ? state.favorites.filter((f) => f !== id) : [...state.favorites, id] };
}

export function markPlayed(state: LibraryState, id: string, now: number): LibraryState {
  return { ...state, lastPlayed: { ...state.lastPlayed, [id]: now } };
}

export type LibraryFilter = 'all' | 'favorites' | 'recent';

export function normalize(s: string): string {
  return s
    .replace(/İ/g, 'i')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

export function filterGames(games: readonly LibraryGame[], state: LibraryState, query: string, filter: LibraryFilter): LibraryGame[] {
  const q = normalize(query.trim());
  let list = games.filter((g) => (q ? normalize(g.name).includes(q) : true));
  if (filter === 'favorites') list = list.filter((g) => state.favorites.includes(g.id));
  if (filter === 'recent') {
    return list
      .filter((g) => (state.lastPlayed[g.id] ?? 0) > 0)
      .sort((a, b) => (state.lastPlayed[b.id] ?? 0) - (state.lastPlayed[a.id] ?? 0));
  }
  return [...list].sort((a, b) => {
    const fa = state.favorites.includes(a.id) ? 0 : 1;
    const fb = state.favorites.includes(b.id) ? 0 : 1;
    return fa - fb || a.name.localeCompare(b.name, 'tr');
  });
}

/** `rnd` [0,1) aralığında rastgele değer (test için dışarıdan verilir). */
export function pickRandom<T>(items: readonly T[], rnd: number): T | null {
  if (items.length === 0) return null;
  return items[Math.min(items.length - 1, Math.floor(rnd * items.length))] ?? null;
}

export function steamHeaderUrl(appId: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${Math.trunc(appId)}/header.jpg`;
}
