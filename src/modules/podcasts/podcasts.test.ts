import { describe, expect, it } from 'vitest';
import { parsePodcast } from '../news/rss';
import { addSub, buildItunesUrl, nextRate, normalizeFeedUrl, parseItunes, preferHttps, resumeAt, sanitizePositions, sanitizeSubs, savePosition } from './podcasts';

const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel><title>Bir Podcast</title>
<itunes:image href="https://img.test/a.jpg"/>
<item><title>Bölüm 1</title><guid>g1</guid><pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate>
<enclosure url="https://cdn.test/1.mp3" type="audio/mpeg" length="1"/><itunes:duration>1:02:03</itunes:duration></item>
<item><title>Sessiz</title><link>https://x.test</link></item>
<item><title>Bölüm 2</title><enclosure url="http://cdn.test/2.mp3"/><itunes:duration>754</itunes:duration></item>
</channel></rss>`;

describe('podcast feed', () => {
  it('reads enclosure, duration and image', () => {
    const f = parsePodcast(xml);
    expect(f.title).toBe('Bir Podcast');
    expect(f.image).toBe('https://img.test/a.jpg');
    expect(f.episodes).toHaveLength(2);
    expect(f.episodes[0]).toMatchObject({ title: 'Bölüm 1', audioUrl: 'https://cdn.test/1.mp3', durationSec: 3723 });
    expect(f.episodes[1]?.durationSec).toBe(754);
  });
  it('rejects non-rss', () => {
    expect(() => parsePodcast('<feed></feed>')).toThrow();
  });
});

describe('podcast state', () => {
  it('normalizes urls and dedupes subs', () => {
    expect(normalizeFeedUrl('feed://a.com/rss')).toBe('https://a.com/rss');
    expect(normalizeFeedUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeFeedUrl('kelime')).toBeNull();
    let s = addSub([], 'a.com/rss', 'A');
    s = addSub(s, 'https://a.com/rss', 'A2');
    expect(s).toHaveLength(1);
    expect(sanitizeSubs([{ url: 'x' }, ...s, 3])).toHaveLength(1);
  });
  it('saves and resumes positions', () => {
    let p = savePosition({}, 'e', 120, 3000);
    expect(resumeAt(p, 'e')).toBe(120);
    p = savePosition(p, 'e', 2995, 3000);
    expect(resumeAt(p, 'e')).toBe(0);
    expect(resumeAt(savePosition({}, 'e', 2, 3000), 'e')).toBe(0);
    expect(sanitizePositions({ a: 5.9, b: -1, c: 'x' })).toEqual({ a: 5 });
  });
  it('cycles rates and upgrades http', () => {
    expect([1, 1.25, 1.5].map(nextRate)).toEqual([1.25, 1.5, 1]);
    expect(preferHttps('http://a.com/x.mp3')).toBe('https://a.com/x.mp3');
  });
  it('parses itunes results', () => {
    expect(buildItunesUrl(' tarih ')).toContain('term=tarih');
    const hits = parseItunes({ results: [{ collectionName: 'T', artistName: 'S', feedUrl: 'https://f.com/r', artworkUrl100: 'https://i.com/a.jpg' }, { collectionName: 'Yok' }] });
    expect(hits).toHaveLength(1);
    expect(parseItunes(null)).toEqual([]);
  });
});
