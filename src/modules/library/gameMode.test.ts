import { describe, expect, it } from 'vitest';
import { effectiveGameMode, sanitizeGameMode } from './gameMode';

describe('gameMode', () => {
  it('sanitizes payload', () => {
    expect(sanitizeGameMode(null)).toEqual({ active: false, name: '' });
    expect(sanitizeGameMode({ active: true, name: 'Hades' })).toEqual({ active: true, name: 'Hades' });
    expect(sanitizeGameMode({ active: 'yes', name: 5 })).toEqual({ active: false, name: '' });
  });
  it('ignores detection when auto is off', () => {
    expect(effectiveGameMode(false, { active: true, name: 'x' })).toEqual({ active: false, name: '' });
    expect(effectiveGameMode(true, { active: true, name: 'x' }).active).toBe(true);
  });
});
