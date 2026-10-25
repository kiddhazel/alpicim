import { describe, expect, it } from 'vitest';
import { currentPositionMs, formatTrackTime, type MediaSession } from './systemService';

const base: Pick<MediaSession, 'status' | 'positionMs' | 'durationMs' | 'updatedAtMs'> = {
  status: 'playing',
  positionMs: 10_000,
  durationMs: 100_000,
  updatedAtMs: 1_000_000,
};

describe('currentPositionMs', () => {
  it('oynatılırken geçen süreyi ekler', () => {
    expect(currentPositionMs(base, 1_005_000)).toBe(15_000);
  });
  it('duraklatılmışken konumu değiştirmez', () => {
    expect(currentPositionMs({ ...base, status: 'paused' }, 1_050_000)).toBe(10_000);
  });
  it('süreye sıkıştırır ve eksiye düşmez', () => {
    expect(currentPositionMs(base, 2_000_000)).toBe(100_000);
    expect(currentPositionMs({ ...base, positionMs: 0 }, 990_000)).toBe(0);
  });
  it('süre bilinmiyorsa üst sınır uygulanmaz', () => {
    expect(currentPositionMs({ ...base, durationMs: null }, 1_500_000)).toBe(510_000);
  });
  it('konum yoksa null', () => {
    expect(currentPositionMs({ ...base, positionMs: null }, 1_005_000)).toBeNull();
  });
  it('örnekleme zamanı yoksa konumu aynen verir', () => {
    expect(currentPositionMs({ ...base, updatedAtMs: null }, 5)).toBe(10_000);
  });
});

describe('formatTrackTime', () => {
  it('m:ss', () => {
    expect(formatTrackTime(0)).toBe('0:00');
    expect(formatTrackTime(65_900)).toBe('1:05');
    expect(formatTrackTime(599_000)).toBe('9:59');
  });
  it('bir saati aşınca h:mm:ss', () => {
    expect(formatTrackTime(3_600_000)).toBe('1:00:00');
    expect(formatTrackTime(3_725_000)).toBe('1:02:05');
  });
  it('geçersiz girdi', () => {
    expect(formatTrackTime(-5)).toBe('0:00');
    expect(formatTrackTime(NaN)).toBe('0:00');
  });
});
