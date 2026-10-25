import { describe, expect, it } from 'vitest';
import { addDays, addEvent, addMonths, monthMatrix, parseDateKey, sanitizeCalendar, sortEvents, toDateKey, upcoming } from './calendar';

describe('calendar helpers', () => {
  it('parses only real dates', () => {
    expect(parseDateKey('2026-02-29')).toBeNull();
    expect(parseDateKey('2024-02-29')).not.toBeNull();
    expect(parseDateKey('2026-13-01')).toBeNull();
    expect(parseDateKey('abc')).toBeNull();
  });

  it('builds a Monday-first 6x7 matrix', () => {
    const m = monthMatrix(2026, 9); // Ekim 2026: 1 Ekim = Persembe
    expect(m).toHaveLength(6);
    expect(m.every((r) => r.length === 7)).toBe(true);
    expect(m[0]?.[0]?.date).toBe('2026-09-28');
    expect(m[0]?.[3]).toMatchObject({ date: '2026-10-01', inMonth: true });
    expect(m[0]?.[0]?.inMonth).toBe(false);
  });

  it('adds days and months across boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('sorts by date, then time (untimed last)', () => {
    const s = sortEvents([
      { id: '1', date: '2026-10-26', title: 'b' },
      { id: '2', date: '2026-10-26', time: '09:00', title: 'a' },
      { id: '3', date: '2026-10-25', title: 'c' },
    ]);
    expect(s.map((e) => e.id)).toEqual(['3', '2', '1']);
  });

  it('filters upcoming within 7 days', () => {
    const ev = [
      { id: '1', date: '2026-10-24', title: 'past' },
      { id: '2', date: '2026-10-25', title: 'today' },
      { id: '3', date: '2026-10-31', title: 'edge' },
      { id: '4', date: '2026-11-01', title: 'out' },
    ];
    expect(upcoming(ev, '2026-10-25', 7).map((e) => e.id)).toEqual(['2', '3']);
  });

  it('sanitizes strictly', () => {
    const out = sanitizeCalendar({
      events: [
        { id: 'a', date: '2026-10-25', time: '25:00', title: ' x ' },
        { id: 'a', date: '2026-10-25', title: 'dup' },
        { id: 'b', date: '2026-02-30', title: 'bad' },
        { id: 'c', date: '2026-10-25', time: '08:30', title: '' },
        { id: 'd', date: '2026-10-25', time: '08:30', title: 'ok' },
        null,
      ],
    });
    expect(out.events).toEqual([
      { id: 'a', date: '2026-10-25', title: 'x' },
      { id: 'd', date: '2026-10-25', time: '08:30', title: 'ok' },
    ]);
    expect(sanitizeCalendar('x').events).toEqual([]);
  });

  it('caps events at 300 and rejects blank titles', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ id: `i${i}`, date: '2026-10-25', title: 't' }));
    expect(sanitizeCalendar({ events: many }).events).toHaveLength(300);
    expect(addEvent([], '2026-10-25', '10:00', '  ')).toEqual([]);
    expect(addEvent(sanitizeCalendar({ events: many }).events, '2026-10-25', '', 'x')).toHaveLength(300);
    expect(addEvent([], '2026-10-25', '10:00', 'a')[0]).toMatchObject({ time: '10:00', title: 'a' });
  });
});
