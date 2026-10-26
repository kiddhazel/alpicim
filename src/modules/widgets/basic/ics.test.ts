import { describe, expect, it } from 'vitest';
import { normalizeIcsUrl, parseDateTime, parseIcs, unescapeText, zonedToDate } from './ics';

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR\r\n`;

describe('normalizeIcsUrl', () => {
  it('accepts https only', () => {
    expect(normalizeIcsUrl('https://example.com/cal.ics')).toBe('https://example.com/cal.ics');
    expect(normalizeIcsUrl('webcal://example.com/cal.ics')).toBe('https://example.com/cal.ics');
    expect(normalizeIcsUrl('http://example.com/cal.ics')).toBeNull();
    expect(normalizeIcsUrl('file:///c:/x.ics')).toBeNull();
    expect(normalizeIcsUrl('https://user:pw@example.com/x')).toBeNull();
    expect(normalizeIcsUrl('not a url')).toBeNull();
  });
});

describe('date parsing', () => {
  it('parses all-day dates', () => {
    const p = parseDateTime('20261026', { VALUE: 'DATE' });
    expect(p?.allDay).toBe(true);
    expect(p?.date.getDate()).toBe(26);
  });

  it('parses UTC', () => {
    const p = parseDateTime('20261026T090000Z', {});
    expect(p?.date.toISOString()).toBe('2026-10-26T09:00:00.000Z');
  });

  it('converts TZID wall time to the real instant', () => {
    // İstanbul UTC+3 (sabit)
    const p = parseDateTime('20261026T090000', { TZID: 'Europe/Istanbul' });
    expect(p?.date.toISOString()).toBe('2026-10-26T06:00:00.000Z');
    // New York, Aralık: UTC-5
    expect(zonedToDate(2026, 12, 1, 9, 0, 0, 'America/New_York')?.toISOString()).toBe('2026-12-01T14:00:00.000Z');
    expect(zonedToDate(2026, 12, 1, 9, 0, 0, 'Not/AZone')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(parseDateTime('hello', {})).toBeNull();
  });
});

describe('parseIcs', () => {
  it('reads a simple event with folding and escapes', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:a1\r\nDTSTART;VALUE=DATE:20261027\r\nSUMMARY:Toplant\r\n ı\\, genel\r\nLOCATION:Oda 3\r\nEND:VEVENT\r\n',
    );
    const ev = parseIcs(ics, '2026-10-01', '2026-11-30');
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ date: '2026-10-27', title: 'Toplantı, genel', location: 'Oda 3', source: 'ics' });
    expect(ev[0]?.time).toBeUndefined();
  });

  it('gives timed events a local HH:MM', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:a2\r\nDTSTART:20261026T100000\r\nSUMMARY:x\r\nEND:VEVENT\r\n');
    expect(parseIcs(ics, '2026-10-01', '2026-11-30')[0]).toMatchObject({ date: '2026-10-26', time: '10:00' });
  });

  it('expands daily with COUNT and EXDATE', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:d\r\nDTSTART;VALUE=DATE:20261001\r\nRRULE:FREQ=DAILY;COUNT=5\r\nEXDATE;VALUE=DATE:20261003\r\nSUMMARY:d\r\nEND:VEVENT\r\n',
    );
    const dates = parseIcs(ics, '2026-10-01', '2026-12-01').map((e) => e.date);
    expect(dates).toEqual(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05']);
  });

  it('expands weekly BYDAY with UNTIL and INTERVAL', () => {
    // 2026-10-05 Pazartesi
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:w\r\nDTSTART;VALUE=DATE:20261005\r\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261031\r\nSUMMARY:w\r\nEND:VEVENT\r\n',
    );
    const dates = parseIcs(ics, '2026-10-01', '2026-12-01').map((e) => e.date);
    expect(dates).toEqual(['2026-10-05', '2026-10-07', '2026-10-19', '2026-10-21']);
  });

  it('weekly without BYDAY repeats on the start weekday and respects the window', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:w2\r\nDTSTART;VALUE=DATE:20261005\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:w\r\nEND:VEVENT\r\n');
    const dates = parseIcs(ics, '2026-10-12', '2026-10-27').map((e) => e.date);
    expect(dates).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
  });

  it('skips cancelled events and events outside the window', () => {
    const ics = wrap(
      'BEGIN:VEVENT\r\nUID:c\r\nSTATUS:CANCELLED\r\nDTSTART;VALUE=DATE:20261027\r\nSUMMARY:c\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:o\r\nDTSTART;VALUE=DATE:20300101\r\nSUMMARY:o\r\nEND:VEVENT\r\n',
    );
    expect(parseIcs(ics, '2026-10-01', '2026-12-01')).toEqual([]);
  });

  it('spreads multi-day all-day events across days', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:m\r\nDTSTART;VALUE=DATE:20261030\r\nDTEND;VALUE=DATE:20261102\r\nSUMMARY:m\r\nEND:VEVENT\r\n');
    expect(parseIcs(ics, '2026-10-01', '2026-12-01').map((e) => e.date)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('ignores malformed input', () => {
    expect(parseIcs('garbage', '2026-10-01', '2026-12-01')).toEqual([]);
    expect(unescapeText('a\\nb\\;c')).toBe('a\nb;c');
  });
});
