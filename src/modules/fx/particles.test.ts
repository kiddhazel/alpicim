import { describe, expect, it } from 'vitest';
import { burst, kindForWeather, particleCount, spawn, step, stepConfetto } from './particles';

describe('fx particles', () => {
  it('maps weather codes to effects', () => {
    expect(kindForWeather(0, true)).toBe('sun');
    expect(kindForWeather(0, false)).toBe('stars');
    expect(kindForWeather(3, true)).toBe('cloud');
    expect(kindForWeather(45, true)).toBe('fog');
    expect(kindForWeather(63, true)).toBe('rain');
    expect(kindForWeather(73, false)).toBe('snow');
  });

  it('keeps density low and bounded', () => {
    expect(particleCount('none', 1920, 1080)).toBe(0);
    expect(particleCount('rain', 7680, 4320)).toBeLessThanOrEqual(160);
  });

  it('wraps falling particles', () => {
    const p = spawn('rain', 100, 100, () => 0.5);
    p.y = 99;
    step(p, 'rain', 1, 100, 100);
    expect(p.y).toBeLessThan(0);
  });

  it('confetti falls and expires', () => {
    const [c] = burst(1, 10, 10, 5, () => 0.5);
    expect(c).toBeDefined();
    if (!c) return;
    c.life = 0.05;
    expect(stepConfetto(c, 0.1)).toBe(false);
    expect(c.color).toBeLessThan(5);
  });
});
