import { describe, expect, it } from 'vitest';
import { addItem, bumpEpisode, nextSeason, pickWinner, planned, sanitizeWatchlist, setStatus, spinDelays, spinSequence } from './watchlist';

describe('watchlist', () => {
  it('adds, dedupes and filters planned', () => {
    let l = addItem([], '  Dark ', 'dizi', 'a');
    l = addItem(l, 'dark', 'dizi', 'b');
    l = addItem(l, 'Dark', 'film', 'c');
    l = addItem(l, '   ', 'film', 'd');
    expect(l.map((i) => i.id)).toEqual(['a', 'c']);
    l = setStatus(l, 'c', 'done');
    expect(planned(l).map((i) => i.id)).toEqual(['a']);
  });

  it('bumps episodes only for series and starts watching', () => {
    let l = addItem(addItem([], 'Dizi', 'dizi', 'a'), 'Film', 'film', 'f');
    l = bumpEpisode(l, 'a', 1);
    expect(l[0]).toMatchObject({ episode: 1, status: 'watching' });
    l = bumpEpisode(l, 'a', -5);
    expect(l[0]?.episode).toBe(0);
    l = bumpEpisode(l, 'f', 1);
    expect(l[1]?.episode).toBe(0);
    l = nextSeason(bumpEpisode(l, 'a', 3), 'a');
    expect(l[0]).toMatchObject({ season: 2, episode: 0 });
  });

  it('sanitizes stored data', () => {
    const s = sanitizeWatchlist({ items: [{ id: 'x', title: 'T', kind: 'zzz', status: 'bad', season: -4, episode: 1e9 }, { id: 'x', title: 'Dup' }, 5, { id: '', title: 'n' }] });
    expect(s.items).toEqual([{ id: 'x', title: 'T', kind: 'film', status: 'planned', season: 1, episode: 999 }]);
    expect(sanitizeWatchlist(null).items).toEqual([]);
  });

  it('builds spin sequence ending at the winner', () => {
    const seq = spinSequence(4, 2, 2);
    expect(seq).toHaveLength(11);
    expect(seq[seq.length - 1]).toBe(2);
    expect(spinSequence(0, 0)).toEqual([]);
    const d = spinDelays(seq.length);
    expect(d[0]).toBeLessThan(d[d.length - 1]!);
    expect(pickWinner(5, 0.99)).toBe(4);
    expect(pickWinner(0)).toBe(-1);
  });
});
