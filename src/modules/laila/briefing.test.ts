import { describe, expect, it } from 'vitest';
import { briefingLines, nextEvent, pickRates, pickWeather, shouldBrief, topHeadline } from './briefing';
import { acknowledge, dueReminder, snooze } from './reminders';

describe('sabah özeti', () => {
  it('yalnız sabah ve günde bir kez', () => {
    expect(shouldBrief(new Date(2026, 9, 26, 8, 0), null)).toBe(true);
    expect(shouldBrief(new Date(2026, 9, 26, 8, 0), '2026-10-26')).toBe(false);
    expect(shouldBrief(new Date(2026, 9, 26, 14, 0), null)).toBe(false);
    expect(shouldBrief(new Date(2026, 9, 26, 3, 0), null)).toBe(false);
  });

  it('önbelleklerden veri seçer', () => {
    expect(
      pickWeather({
        a: { temperature: 12, code: 1, fetchedAt: 1, daily: [{ min: 8, max: 15 }] },
        b: { temperature: 20, code: 2, fetchedAt: 9, daily: [] },
      }),
    ).toEqual({ temp: 20, code: 2, min: null, max: null });
    expect(pickRates({ reference: { data: [{ symbol: 'USD/TRY', price: 40 }, { symbol: 'EUR/TRY', price: 45 }] } })).toEqual({ usd: 40, eur: 45 });
    expect(pickRates(null)).toEqual({ usd: null, eur: null });
    expect(topHeadline({ f: { items: [{ title: 'Eski', publishedAt: 1 }, { title: 'Yeni', publishedAt: 5 }] } })).toBe('Yeni');
    const ws = {
      items: [
        {
          widgets: [
            {
              type: 'calendar',
              config: {
                events: [
                  { date: '2026-10-26', time: '07:00', title: 'Geçti' },
                  { date: '2026-10-26', time: '15:00', title: 'Toplantı' },
                  { date: '2026-10-28', title: 'Sonra' },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(nextEvent(ws, '2026-10-26', '09:00')?.title).toBe('Toplantı');
    expect(nextEvent(ws, '2026-10-29', '09:00')).toBeNull();
  });

  it('veri yoksa yine de cümle üretir; tam veri en çok 5 balon', () => {
    const empty = briefingLines({ weather: null, usd: null, eur: null, event: null, headline: null }, '2026-10-26');
    expect(empty).toHaveLength(2);
    const full = briefingLines(
      {
        weather: { temp: 14.4, code: 1, min: 9, max: 17, desc: 'açık' },
        usd: 40.1,
        eur: 45.2,
        event: { date: '2026-10-26', time: '15:00', title: 'Toplantı' },
        headline: 'Manşet',
      },
      '2026-10-26',
    );
    expect(full).toHaveLength(5);
    expect(full[1]).toContain('14');
    expect(full[3]).toContain('Toplantı');
  });
});

describe('hatırlatıcılar', () => {
  const mins = { eye: 40, water: 90 };
  it('süre dolunca tetiklenir, tamam sıfırlar, ertele 5 dk sonra', () => {
    const clock = { eye: 0, water: 0 };
    expect(dueReminder(clock, 39 * 60_000, mins)).toBeNull();
    expect(dueReminder(clock, 40 * 60_000, mins)).toBe('eye');
    const ok = acknowledge(clock, 'eye', 40 * 60_000);
    expect(dueReminder(ok, 41 * 60_000, mins)).toBeNull();
    const z = snooze(clock, 'eye', 40 * 60_000, mins);
    expect(dueReminder(z, 44 * 60_000, mins)).toBeNull();
    expect(dueReminder(z, 45 * 60_000, mins)).toBe('eye');
  });
});
