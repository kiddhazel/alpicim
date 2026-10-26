import { describe, expect, it } from 'vitest';
import { DEFAULT_BOND, MAX_PET_POINTS_PER_DAY, levelOf, newlyUnlocked, pet, registerVisit, sanitizeBond, selectOutfit } from './bond';

describe('Laila bağı', () => {
  it('günün ilk ziyareti +3 puan verir, aynı gün tekrar vermez', () => {
    const a = registerVisit(DEFAULT_BOND, '2026-10-25');
    expect(a.gained).toBe(3);
    expect(a.bond.streakDays).toBe(1);
    expect(registerVisit(a.bond, '2026-10-25').gained).toBe(0);
  });

  it('ardışık günlerde seri artar, kopunca sıfırlanır', () => {
    let b = registerVisit(DEFAULT_BOND, '2026-10-30').bond;
    b = registerVisit(b, '2026-10-31').bond;
    b = registerVisit(b, '2026-11-01').bond;
    expect(b.streakDays).toBe(3);
    expect(registerVisit(b, '2026-11-04').bond.streakDays).toBe(1);
  });

  it('okşama günde en çok 20 puan', () => {
    let b = registerVisit(DEFAULT_BOND, '2026-10-25').bond;
    for (let i = 0; i < 30; i++) b = pet(b, '2026-10-25').bond;
    expect(b.points).toBe(3 + MAX_PET_POINTS_PER_DAY);
    expect(pet(b, '2026-10-26').gained).toBe(4);
  });

  it('seviye ve kıyafet açılışı', () => {
    expect(levelOf(0).index).toBe(0);
    expect(levelOf(40).index).toBe(2);
    expect(levelOf(500).next).toBeNull();
    expect(newlyUnlocked(20, 26)).toEqual(['night']);
    expect(newlyUnlocked(26, 30)).toEqual([]);
  });

  it('kıyafet seçimi puana bağlı; bozuk veri düzeltilir', () => {
    expect(selectOutfit(DEFAULT_BOND, 'gold').outfit).toBe('default');
    expect(selectOutfit({ ...DEFAULT_BOND, points: 30 }, 'night').outfit).toBe('night');
    expect(sanitizeBond({ points: 5, outfit: 'gold' }).outfit).toBe('default');
    expect(sanitizeBond('x')).toEqual(DEFAULT_BOND);
    expect(sanitizeBond({ points: -4, streakDays: 'a' }).points).toBe(0);
  });
});
