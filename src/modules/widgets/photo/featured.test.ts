import { describe, expect, it } from 'vitest';
import { featuredUrl, isWikimediaUrl, localDay, parseFeatured, parseFeaturedBody } from './featured';

const sample = {
  image: {
    title: 'File:Example.jpg',
    thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/640px-Example.jpg', width: 640, height: 480 },
    image: { source: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Example.jpg', width: 4000, height: 3000 },
    file_page: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
    description: { text: '  Gün batımında  bir  göl.\nYakın çekim. ' },
    artist: { text: 'Ayşe Yılmaz' },
  },
};

describe('parseFeatured', () => {
  it('extracts the photo fields with normalized text', () => {
    expect(parseFeatured(sample, '2026-10-26', 'tr', 1)).toEqual({
      day: '2026-10-26',
      lang: 'tr',
      thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Example.jpg/640px-Example.jpg',
      description: 'Gün batımında bir göl. Yakın çekim.',
      artist: 'Ayşe Yılmaz',
      filePage: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
      fetchedAt: 1,
    });
  });

  it('falls back to the full image source when no thumbnail is given', () => {
    const noThumb = { image: { ...sample.image, thumbnail: undefined } };
    expect(parseFeatured(noThumb, '2026-10-26', 'en')?.thumbnail).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/a/ab/Example.jpg',
    );
  });

  it('returns null when there is no image or the URLs are not safe Wikimedia https links', () => {
    expect(parseFeatured({}, '2026-10-26')).toBeNull();
    expect(parseFeatured(null, '2026-10-26')).toBeNull();
    expect(parseFeatured({ image: { ...sample.image, file_page: 'https://evil.example/x' } }, '2026-10-26')).toBeNull();
    expect(
      parseFeatured({ image: { ...sample.image, thumbnail: { source: 'http://upload.wikimedia.org/a.jpg' } } }, '2026-10-26'),
    ).toBeNull();
  });

  it('truncates long descriptions and tolerates a missing artist', () => {
    const long = { image: { ...sample.image, description: { text: 'a'.repeat(400) }, artist: undefined } };
    const p = parseFeatured(long, '2026-10-26');
    expect(p?.description.length).toBe(240);
    expect(p?.description.endsWith('…')).toBe(true);
    expect(p?.artist).toBe('');
  });

  it('parses a raw body and rejects broken JSON', () => {
    expect(parseFeaturedBody(JSON.stringify(sample), '2026-10-26', 'tr', 2)?.fetchedAt).toBe(2);
    expect(() => parseFeaturedBody('{not json', '2026-10-26', 'tr')).toThrow();
  });
});

describe('helpers', () => {
  it('builds the featured endpoint for a day', () => {
    expect(featuredUrl('tr', '2026-10-06')).toBe('https://api.wikimedia.org/feed/v1/wikipedia/tr/featured/2026/10/06');
  });

  it('formats the local day as YYYY-MM-DD', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('accepts only https Wikimedia hosts', () => {
    expect(isWikimediaUrl('https://commons.wikimedia.org/wiki/File:A.jpg')).toBe(true);
    expect(isWikimediaUrl('https://wikimedia.org/')).toBe(true);
    expect(isWikimediaUrl('https://notwikimedia.org/')).toBe(false);
    expect(isWikimediaUrl('javascript:alert(1)')).toBe(false);
    expect(isWikimediaUrl(undefined)).toBe(false);
  });
});
