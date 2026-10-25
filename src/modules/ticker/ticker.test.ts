import { describe, expect, it } from 'vitest';
import type { MarketCache } from '../markets/marketService';
import type { Quote } from '../markets/types';
import type { NewsItem } from '../news/types';
import {
  changeTone,
  formatChange,
  headlineChars,
  marqueeDurationSec,
  MARQUEE_MIN_SEC,
  nextIndex,
  selectHeadlines,
  selectQuotes,
} from './ticker';

const quote = (key: string, extra: Partial<Quote> = {}): Quote => ({
  key,
  symbol: key,
  label: key,
  price: 10,
  change: null,
  changePct: null,
  currency: 'TRY',
  kind: 'reference',
  providerId: 'p',
  sourceName: 's',
  asOf: null,
  fetchedAt: 1,
  ...extra,
});

const news = (id: string, publishedAt: number | null, title = id): NewsItem => ({
  id,
  title,
  link: `https://x/${id}`,
  source: 'S',
  publishedAt,
  summary: '',
  category: 'dunya',
  feedId: 'f',
});

const cacheOf = (p: Partial<MarketCache>): MarketCache => ({ reference: null, history: {}, live: null, gold: null, watch: {}, ...p });
const section = <T,>(data: T) => ({ data, error: null, fetchedAt: 1 });

describe('selectQuotes', () => {
  it('veri yoksa boş döner', () => {
    expect(selectQuotes(cacheOf({}))).toEqual([]);
  });
  it('sırayı korur, tekrarı eler ve sınırlar', () => {
    const cache = cacheOf({
      reference: section([quote('a'), quote('b')]),
      gold: section([quote('g'), quote('a')]),
      live: section([quote('l')]),
      watch: { w1: section(quote('w1')), w2: section(null) },
    });
    expect(selectQuotes(cache).map((q) => q.key)).toEqual(['a', 'b', 'g', 'l', 'w1']);
    expect(selectQuotes(cache, 3).map((q) => q.key)).toEqual(['a', 'b', 'g']);
    expect(selectQuotes(cache, 0)).toEqual([]);
  });
  it('geçersiz fiyatı atlar', () => {
    expect(selectQuotes(cacheOf({ reference: section([quote('a', { price: NaN })]) }))).toEqual([]);
  });
});

describe('selectHeadlines', () => {
  it('yeniden eskiye sıralar, tarihsizleri sona atar', () => {
    const out = selectHeadlines([news('a', 1), news('b', null), news('c', 5), news('d', 3)]);
    expect(out.map((i) => i.id)).toEqual(['c', 'd', 'a', 'b']);
  });
  it('sınırlar ve boş başlıkları eler', () => {
    const items = Array.from({ length: 30 }, (_, i) => news(`n${i}`, i));
    expect(selectHeadlines(items)).toHaveLength(15);
    expect(selectHeadlines([news('x', 1, '  ')])).toEqual([]);
  });
  it('kategoriye göre süzer', () => {
    const items = [news('a', 1), { ...news('b', 2), category: 'spor' as const }];
    expect(selectHeadlines(items, 15, 'spor').map((i) => i.id)).toEqual(['b']);
    expect(selectHeadlines(items, 15, 'all')).toHaveLength(2);
  });
});

describe('değişim', () => {
  it('tonu belirler', () => {
    expect(changeTone({ changePct: 1, change: null })).toBe('up');
    expect(changeTone({ changePct: -1, change: null })).toBe('down');
    expect(changeTone({ changePct: 0, change: null })).toBe('flat');
    expect(changeTone({ changePct: null, change: null })).toBe('none');
    expect(changeTone({ changePct: null, change: -2 })).toBe('down');
  });
  it('yüzdeyi biçimler', () => {
    expect(formatChange({ changePct: null })).toBeNull();
    expect(formatChange({ changePct: 1.5 })).toContain('+1');
  });
});

describe('kayan yazı', () => {
  it('süre uzunlukla orantılı, alt sınırlı', () => {
    expect(marqueeDurationSec(0)).toBe(MARQUEE_MIN_SEC);
    expect(marqueeDurationSec(3000)).toBeGreaterThan(marqueeDurationSec(2000));
  });
  it('hıza göre süre değişir', () => {
    expect(marqueeDurationSec(6000, 'slow')).toBeGreaterThan(marqueeDurationSec(6000, 'normal'));
    expect(marqueeDurationSec(6000, 'fast')).toBeLessThan(marqueeDurationSec(6000, 'normal'));
    expect(marqueeDurationSec(6000)).toBe(marqueeDurationSec(6000, 'normal'));
  });
  it('karakter sayar', () => {
    expect(headlineChars([{ title: 'abc', source: 'de' }])).toBe(11);
  });
  it('döngüsel dizin', () => {
    expect(nextIndex(2, 3)).toBe(0);
    expect(nextIndex(0, 0)).toBe(0);
  });
});
