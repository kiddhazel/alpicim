import { describe, expect, it } from 'vitest';
import { recentIds, recordLaunch, sanitizeUsage, topIds } from './usage';

describe('sanitizeUsage', () => {
  it('geçersiz girdilerde boş döner', () => {
    expect(sanitizeUsage(null)).toEqual({});
    expect(sanitizeUsage([1, 2])).toEqual({});
    expect(sanitizeUsage('x')).toEqual({});
  });
  it('bozuk kayıtları ayıklar, geçerlileri korur', () => {
    const out = sanitizeUsage({
      a: { count: 3, lastAt: 100 },
      b: { count: 'x', lastAt: 1 },
      c: { count: 0, lastAt: 1 },
      d: null,
      e: { count: 2.7, lastAt: -5 },
    });
    expect(out).toEqual({ a: { count: 3, lastAt: 100 } });
  });
});

describe('recordLaunch', () => {
  it('sayacı artırır ve zamanı günceller', () => {
    const a = recordLaunch({}, 'x', 10);
    const b = recordLaunch(a, 'x', 20);
    expect(b.x).toEqual({ count: 2, lastAt: 20 });
    expect(a.x).toEqual({ count: 1, lastAt: 10 });
  });
  it('kayıt sayısını sınırlar', () => {
    let u = {};
    for (let i = 0; i < 320; i++) u = recordLaunch(u, `id${i}`, i);
    expect(Object.keys(u)).toHaveLength(300);
    expect(u).toHaveProperty('id319');
    expect(u).not.toHaveProperty('id0');
  });
});

describe('sıralama', () => {
  const usage = {
    a: { count: 5, lastAt: 10 },
    b: { count: 1, lastAt: 50 },
    c: { count: 5, lastAt: 30 },
    gone: { count: 99, lastAt: 99 },
  };
  const valid = ['a', 'b', 'c', 'd'];
  it('recentIds en yeniyi başa alır, silinmiş ve kullanılmamışları dışlar', () => {
    expect(recentIds(usage, valid, 5)).toEqual(['b', 'c', 'a']);
    expect(recentIds(usage, valid, 2)).toEqual(['b', 'c']);
  });
  it('topIds sayıya göre, eşitlikte yeniye göre sıralar', () => {
    expect(topIds(usage, valid, 5)).toEqual(['c', 'a', 'b']);
  });
});
