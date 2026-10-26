import { describe, expect, it } from 'vitest';
import { DEFAULT_LIBRARY, filterGames, markPlayed, pickRandom, sanitizeLibrary, steamHeaderUrl, toggleFavorite, type LibraryGame } from './library';

const g = (id: string, name: string): LibraryGame => ({ id, name, store: 'steam', appId: 1, hasIcon: false });
const games = [g('a', 'Hades'), g('b', 'Counter-Strike 2'), g('c', 'Işık Oyunu')];

describe('library', () => {
  it('sanitizes bad data', () => {
    expect(sanitizeLibrary(null)).toEqual(DEFAULT_LIBRARY);
    const s = sanitizeLibrary({ favorites: ['a', 'a', 3, ''], lastPlayed: { a: 5, b: 'x', c: -1 } });
    expect(s.favorites).toEqual(['a']);
    expect(s.lastPlayed).toEqual({ a: 5 });
  });
  it('toggles favorites and sorts them first', () => {
    const s = toggleFavorite(DEFAULT_LIBRARY, 'c');
    expect(filterGames(games, s, '', 'all').map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(filterGames(games, s, '', 'favorites').map((x) => x.id)).toEqual(['c']);
    expect(toggleFavorite(s, 'c').favorites).toEqual([]);
  });
  it('searches Turkish-insensitively', () => {
    expect(filterGames(games, DEFAULT_LIBRARY, 'isik', 'all').map((x) => x.id)).toEqual(['c']);
    expect(filterGames(games, DEFAULT_LIBRARY, 'COUNTER', 'all').map((x) => x.id)).toEqual(['b']);
  });
  it('orders recent by last played', () => {
    let s = markPlayed(DEFAULT_LIBRARY, 'a', 100);
    s = markPlayed(s, 'c', 200);
    expect(filterGames(games, s, '', 'recent').map((x) => x.id)).toEqual(['c', 'a']);
  });
  it('picks random safely', () => {
    expect(pickRandom([], 0.5)).toBeNull();
    expect(pickRandom(games, 0)?.id).toBe('a');
    expect(pickRandom(games, 0.999999)?.id).toBe('c');
  });
  it('builds header url', () => {
    expect(steamHeaderUrl(730)).toBe('https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg');
  });
});
