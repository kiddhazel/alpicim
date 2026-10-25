import { describe, expect, it } from 'vitest';
import { dedupeNews, jaccard, normalizeTitle } from './dedupe';
import type { NewsItem } from './types';

function item(partial: Partial<NewsItem> & Pick<NewsItem, 'id' | 'title' | 'link'>): NewsItem {
  return {
    source: 'Kaynak',
    publishedAt: 0,
    summary: '',
    category: 'turkiye',
    feedId: 'f',
    ...partial,
  };
}

describe('normalizeTitle', () => {
  it('Türkçe karakterleri ve noktalamayı sadeleştirir', () => {
    expect(normalizeTitle('İSTANBUL’da Şiddetli Yağış!')).toBe('istanbul da siddetli yagis');
    expect(normalizeTitle('Işık hızı ölçüldü')).toBe('isik hizi olculdu');
  });
});

describe('dedupeNews', () => {
  it('aynı bağlantıyı tek habere indirir', () => {
    const out = dedupeNews([
      item({ id: '1', title: 'A haberi', link: 'https://x.example/a?utm_source=rss' }),
      item({ id: '2', title: 'A haberi (güncellendi)', link: 'https://www.x.example/a', source: 'Diğer' }),
    ]);
    expect(out).toHaveLength(1);
  });

  it('çok benzer başlıkları birleştirir ve diğer kaynağı kaydeder', () => {
    const out = dedupeNews([
      item({ id: '1', title: 'Merkez Bankası faiz kararını açıkladı politika faizi sabit', link: 'https://a.example/1', source: 'A', publishedAt: 2 }),
      item({ id: '2', title: 'Merkez Bankası faiz kararını açıkladı: politika faizi sabit', link: 'https://b.example/2', source: 'B', publishedAt: 1 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.source).toBe('A');
    expect(out[0]?.alsoIn).toEqual(['B']);
  });

  it('farklı haberleri korur ve yeniden eskiye sıralar', () => {
    const out = dedupeNews([
      item({ id: '1', title: 'Deprem bölgesinde yeni konutlar teslim edildi', link: 'https://a.example/1', publishedAt: 1 }),
      item({ id: '2', title: 'Milli takım hazırlık maçında galip geldi', link: 'https://a.example/2', publishedAt: 5 }),
    ]);
    expect(out.map((i) => i.id)).toEqual(['2', '1']);
  });

  it('kısa başlıklarda yalnızca birebir eşleşmeyi tekrar sayar', () => {
    const out = dedupeNews([
      item({ id: '1', title: 'Borsa yükseldi', link: 'https://a.example/1' }),
      item({ id: '2', title: 'Borsa düştü', link: 'https://a.example/2' }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('jaccard', () => {
  it('boş kümelerde 0 döner', () => {
    expect(jaccard(new Set(), new Set(['a']))).toBe(0);
  });
});
