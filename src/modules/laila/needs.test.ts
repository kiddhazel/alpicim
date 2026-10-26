import { describe, expect, it } from 'vitest';
import { adjust, applyDecay, defaultNeeds, feed, moodOf, NEEDS_FLOOR, sanitizeNeeds, snackReadyIn } from './needs';

const H = 3_600_000;

describe('Laila ihtiyaçları', () => {
  it('zamanla azalır ama tabanın altına inmez ve çevrimdışı tavanı vardır', () => {
    const n = defaultNeeds(0);
    const a = applyDecay(n, 2 * H);
    expect(a.hunger).toBeLessThan(n.hunger);
    const b = applyDecay(n, 1000 * H);
    expect(b.hunger).toBeGreaterThanOrEqual(NEEDS_FLOOR);
    expect(b.hunger).toBe(Math.max(NEEDS_FLOOR, n.hunger - 4 * 8));
  });

  it('ikram bekleme süresine uyar', () => {
    const n = { ...defaultNeeds(0), hunger: 30 };
    const fed = feed(n, 'cookie', 1000);
    expect(fed.hunger).toBe(55);
    expect(feed(fed, 'cookie', 2000)).toBe(fed);
    expect(snackReadyIn(fed, 'cookie', 2000)).toBe(119_000);
    expect(feed(fed, 'cookie', 200_000).hunger).toBe(80);
  });

  it('ruh hâli en düşük ihtiyaca göre', () => {
    expect(moodOf(defaultNeeds(0))).toBe('ok');
    expect(moodOf(adjust(defaultNeeds(0), { energy: -80 }))).toBe('sleepy');
    expect(moodOf(adjust(defaultNeeds(0), { hunger: -70 }))).toBe('hungry');
    expect(moodOf(adjust(defaultNeeds(0), { fun: -70 }))).toBe('bored');
  });

  it('bozuk veri düzeltilir', () => {
    expect(sanitizeNeeds('x', 5).updatedAt).toBe(5);
    expect(sanitizeNeeds({ hunger: 500, fun: 'a' }, 5).hunger).toBe(100);
  });
});
