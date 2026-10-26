import { describe, expect, it } from 'vitest';
import { showInternalAudio } from './audioService';

describe('showInternalAudio', () => {
  it('prefers internal audio while playing', () => {
    expect(showInternalAudio(true, true, true)).toBe(true);
  });
  it('falls back to SMTC when internal is paused and SMTC plays', () => {
    expect(showInternalAudio(true, false, true)).toBe(false);
  });
  it('keeps paused internal source when nothing else plays', () => {
    expect(showInternalAudio(true, false, false)).toBe(true);
    expect(showInternalAudio(false, false, false)).toBe(false);
  });
});
