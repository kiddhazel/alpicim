import { describe, expect, it } from 'vitest';
import { dayPart, nextBehavior, reply, talkDelayMs } from './brain';

describe('dayPart', () => {
  it('saat aralıklarını gün bölümüne çevirir', () => {
    expect(dayPart(8)).toBe('morning');
    expect(dayPart(13)).toBe('afternoon');
    expect(dayPart(20)).toBe('evening');
    expect(dayPart(2)).toBe('night');
  });
});

describe('talkDelayMs', () => {
  it('sessizde hiç konuşmaz', () => {
    expect(talkDelayMs('quiet')).toBeNull();
  });

  it('sık konuşan kip 25 sn ile başlar', () => {
    expect(talkDelayMs('chatty', () => 0)).toBe(25000);
  });

  it('normal kip en fazla 150 sn bekler', () => {
    expect(talkDelayMs('normal', () => 1)).toBe(150000);
  });
});

describe('nextBehavior', () => {
  const rolls = Array.from({ length: 100 }, (_, i) => i / 100);

  it('canPeek false iken peek dönmez', () => {
    for (const r of rolls) {
      const b = nextBehavior({ canPeek: false, canLeave: true, hour: 14 }, () => r);
      expect(b).not.toBe('peek');
    }
  });

  it('canLeave false iken leave dönmez', () => {
    for (const r of rolls) {
      const b = nextBehavior({ canPeek: true, canLeave: false, hour: 14 }, () => r);
      expect(b).not.toBe('leave');
    }
  });
});

describe('reply', () => {
  const now = new Date(2026, 0, 1, 9, 5);

  it('selam wave hareketi ile yanıtlanır', () => {
    const r = reply('selam', { now }, () => 0);
    expect(r.action).toBe('wave');
    expect(r.text.length).toBeGreaterThan(0);
  });

  it('dışarı çık leave hareketi verir', () => {
    expect(reply('dışarı çık', { now }).action).toBe('leave');
  });

  it('oyna: oyunlar açıkken play, değilken ipucu', () => {
    expect(reply('oyna benimle', { now, gamesVisible: true }).action).toBe('play');
    const hint = reply('oyun oynayalım', { now });
    expect(hint.action).toBeUndefined();
    expect(hint.text.length).toBeGreaterThan(0);
  });

  it('play yalnız canPlay iken seçilir', () => {
    for (let i = 0; i < 50; i++) expect(nextBehavior({ canPeek: false, canLeave: false, hour: 12 }, () => i / 50)).not.toBe('play');
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(nextBehavior({ canPeek: false, canLeave: false, hour: 12, canPlay: true }, () => i / 100));
    expect(seen.has('play')).toBe(true);
  });

  it('saklan peek hareketi verir', () => {
    expect(reply('saklan', { now }).action).toBe('peek');
  });

  it('saat kaç saati metne koyar', () => {
    expect(reply('saat kaç', { now }).text).toContain('09:05');
  });

  it('boş girdi için boş olmayan yanıt döner', () => {
    expect(reply('', { now }).text.length).toBeGreaterThan(0);
  });

  it('bilinmeyen girdi hareketsiz, boş olmayan yanıt döner', () => {
    const r = reply('asdfgh', { now });
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.action).toBeUndefined();
  });
});
