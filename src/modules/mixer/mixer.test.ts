import { describe, expect, it } from 'vitest';
import { EMPTY_MIXER, fromPercent, patchSession, sanitizeMixer, toPercent } from './mixer';

describe('mixer', () => {
  it('sanitizes Rust output', () => {
    const s = sanitizeMixer({
      master: 1.7,
      masterMuted: true,
      sessions: [
        { id: 'a', name: 'Spotify', exe: 'C:\\s.exe', volume: 0.5, muted: false, system: false, active: true },
        { id: '', name: 'bad' },
        null,
        { id: 'b', volume: 'x' },
      ],
    });
    expect(s.master).toBe(1);
    expect(s.masterMuted).toBe(true);
    expect(s.sessions.map((x) => x.id)).toEqual(['a', 'b']);
    expect(s.sessions[1]).toMatchObject({ volume: 0, name: '', exe: null });
    expect(sanitizeMixer('nope')).toEqual(EMPTY_MIXER);
  });

  it('converts percents', () => {
    expect(toPercent(0.456)).toBe(46);
    expect(fromPercent(250)).toBe(1);
    expect(fromPercent(NaN)).toBe(0);
  });

  it('patches master and sessions', () => {
    const base = sanitizeMixer({ master: 0.2, sessions: [{ id: 'a', volume: 0.1 }] });
    expect(patchSession(base, 'master', { volume: 0.9 }).master).toBe(0.9);
    expect(patchSession(base, 'a', { muted: true }).sessions[0]?.muted).toBe(true);
  });
});
