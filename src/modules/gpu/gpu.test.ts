import { describe, expect, it } from 'vitest';
import { formatMiB, memoryPercent, pushSample, sparkPoints, tempTone } from './gpu';

describe('gpu', () => {
  it('keeps a bounded history and skips nulls', () => {
    expect(pushSample([1, 2], null)).toEqual([1, 2]);
    expect(pushSample([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });
  it('classifies temperature', () => {
    expect(tempTone(60)).toBe('ok');
    expect(tempTone(78)).toBe('warn');
    expect(tempTone(90)).toBe('hot');
    expect(tempTone(null)).toBe('ok');
  });
  it('builds sparkline points', () => {
    expect(sparkPoints([5], 100, 20)).toBe('');
    expect(sparkPoints([0, 100], 100, 20)).toBe('0.0,20.0 100.0,0.0');
  });
  it('computes memory', () => {
    expect(memoryPercent(1024, 4096)).toBe(25);
    expect(memoryPercent(null, 4096)).toBeNull();
    expect(formatMiB(512)).toBe('512 MB');
    expect(formatMiB(2048)).toBe('2.0 GB');
  });
});
