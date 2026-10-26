import { describe, expect, it } from 'vitest';
import { buildSearchUrl, parseStations, pickCurated, sanitizeFavorites, toggleFavorite } from './radio';

const raw = [
  { stationuuid: 'a', name: ' Power  FM ', url_resolved: 'https://x.com/p', favicon: 'https://x.com/i.png', bitrate: 128 },
  { stationuuid: 'b', name: 'Eski', url_resolved: 'http://x.com/e' },
  { stationuuid: 'a', name: 'Kopya', url_resolved: 'https://x.com/k' },
  { stationuuid: 'c', name: 'Kral FM', url: 'https://x.com/k', favicon: 'http://x.com/i.png' },
  { name: 'Kimliksiz', url: 'https://x.com/z' },
];

describe('radio', () => {
  it('keeps https only and dedupes', () => {
    const r = parseStations(raw);
    expect(r.stations.map((s) => s.id)).toEqual(['a', 'c']);
    expect(r.skippedHttp).toBe(1);
    expect(r.stations[0]?.name).toBe('Power FM');
    expect(r.stations[1]?.favicon).toBe('');
    expect(parseStations(null).stations).toEqual([]);
  });

  it('builds search urls', () => {
    const u = buildSearchUrl({ name: 'kral fm', limit: 999 });
    expect(u).toContain('name=kral+fm');
    expect(u).toContain('countrycode=TR');
    expect(u).toContain('limit=200');
    expect(buildSearchUrl({ country: '' })).not.toContain('countrycode');
  });

  it('picks curated by name', () => {
    const { stations } = parseStations(raw);
    expect(pickCurated(stations, 'kral fm')?.id).toBe('c');
    expect(pickCurated(stations, 'Yok')).toBeNull();
  });

  it('sanitizes and toggles favorites', () => {
    const { stations } = parseStations(raw);
    const f = toggleFavorite([], stations[0]!);
    expect(f).toHaveLength(1);
    expect(toggleFavorite(f, stations[0]!)).toHaveLength(0);
    expect(sanitizeFavorites([{ id: 'x', name: 'n', url: 'http://a' }, 5, { id: 'y', name: 'n', url: 'https://a' }])).toHaveLength(1);
  });
});
