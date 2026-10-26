import { describe, expect, it } from 'vitest';
import { answerQuery, convertUnit, evalExpression, rankQuick, recentClips, type QuickEntry } from './quickLogic';

const rates = new Map([['TRY', 1], ['USD', 40], ['EUR', 44]]);

describe('evalExpression', () => {
  it('önceliği ve parantezi uygular', () => {
    expect(evalExpression('2+3*4')).toBe(14);
    expect(evalExpression('(2+3)*4')).toBe(20);
    expect(evalExpression('2^3^2')).toBe(512);
    expect(evalExpression('-3 + 5')).toBe(2);
    expect(evalExpression('10 % 4')).toBe(2);
    expect(evalExpression('1,5*2')).toBe(3);
  });
  it('geçersiz girdiyi reddeder', () => {
    expect(evalExpression('')).toBeNull();
    expect(evalExpression('1/0')).toBeNull();
    expect(evalExpression('2+')).toBeNull();
    expect(evalExpression('alert(1)')).toBeNull();
    expect(evalExpression('(1+2')).toBeNull();
    expect(evalExpression('('.repeat(100) + '1' + ')'.repeat(100))).toBeNull();
  });
});

describe('answerQuery', () => {
  it('= önekiyle hesaplar', () => {
    expect(answerQuery('=2*(3+4)')?.text).toBe('14');
    expect(answerQuery('=1/3')?.text).toBe('0,333333');
    expect(answerQuery('=abc')).toBeNull();
  });
  it('birimleri çevirir', () => {
    expect(answerQuery('10 km')?.text).toBe('6,213712 mil');
    expect(answerQuery('100 c to f')?.text).toBe('212 °F');
    expect(answerQuery('32 f')?.text).toBe('0 °C');
    expect(answerQuery('2 kg lb')?.copy).toBe('4,409245');
    expect(answerQuery('2,54 cm in')?.text).toBe('1 inç');
    expect(convertUnit(1, 'km', 'kg')).toBeNull();
  });
  it('TCMB kurlarıyla dövizi çevirir', () => {
    expect(answerQuery('100 usd', rates)?.copy).toBe('4.000,00');
    expect(answerQuery('50 eur try', rates)?.text).toBe('2.200,00 TRY');
    expect(answerQuery('88 eur to usd', rates)?.text).toBe('96,80 USD');
    expect(answerQuery('100 gbp', rates)).toBeNull();
    expect(answerQuery('100 usd')).toBeNull();
  });
});

describe('rankQuick / recentClips', () => {
  const entries: QuickEntry[] = [
    { id: 'p:news', kind: 'panel', title: 'Haberler', ref: 'news' },
    { id: 'a:1', kind: 'app', title: 'Notepad', subtitle: 'Araçlar', ref: '1' },
    { id: 'n:1', kind: 'note', title: 'Alışveriş listesi', ref: '1' },
  ];
  it('başlık eşleşmesini önceler, aksan duyarsızdır', () => {
    expect(rankQuick(entries, 'alisveris').map((e) => e.id)).toEqual(['n:1']);
    expect(rankQuick(entries, 'hab')[0]?.id).toBe('p:news');
    expect(rankQuick(entries, 'zzz')).toEqual([]);
    expect(rankQuick(entries, '', 2)).toHaveLength(2);
  });
  it('son 10 pano kaydı en yeniden eskiye', () => {
    const clips = Array.from({ length: 14 }, (_, i) => ({ id: String(i), text: `kayıt ${i}`, at: i, pinned: false }));
    const out = recentClips(clips);
    expect(out).toHaveLength(10);
    expect(out[0]?.id).toBe('13');
    expect(recentClips(clips, 'kayıt 7').map((c) => c.id)).toEqual(['7']);
  });
});
