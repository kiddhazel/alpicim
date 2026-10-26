import { describe, expect, it } from 'vitest';
import {
  dismissSaver,
  idleReached,
  INITIAL_SAVER,
  makeMotes,
  nextSaverState,
  sanitizeScreensaverMinutes,
} from './saverLogic';

const base = { enabled: true, minutes: 5, idleSeconds: 0, mainVisible: true };

describe('idleReached / sanitize', () => {
  it('eşiği dakikadan hesaplar', () => {
    expect(idleReached(299, 5)).toBe(false);
    expect(idleReached(300, 5)).toBe(true);
    expect(idleReached(Number.NaN, 5)).toBe(false);
  });
  it('geçersiz dakika varsayılana döner', () => {
    expect(sanitizeScreensaverMinutes(10)).toBe(10);
    expect(sanitizeScreensaverMinutes(7)).toBe(5);
    expect(sanitizeScreensaverMinutes('3')).toBe(5);
  });
});

describe('nextSaverState', () => {
  it('eşik aşılınca ve ana pencere görünürken açılır', () => {
    expect(nextSaverState(INITIAL_SAVER, { ...base, idleSeconds: 301 }).shown).toBe(true);
    expect(nextSaverState(INITIAL_SAVER, { ...base, idleSeconds: 301, mainVisible: false }).shown).toBe(false);
    expect(nextSaverState(INITIAL_SAVER, { ...base, enabled: false, idleSeconds: 999 }).shown).toBe(false);
  });
  it('kapatıldıktan sonra etkinlik görülene dek yeniden açılmaz', () => {
    let s = dismissSaver();
    s = nextSaverState(s, { ...base, idleSeconds: 305 });
    expect(s.shown).toBe(false);
    s = nextSaverState(s, { ...base, idleSeconds: 2 });
    expect(s.armed).toBe(true);
    s = nextSaverState(s, { ...base, idleSeconds: 400 });
    expect(s.shown).toBe(true);
  });
  it('girdi gelince kapanır; pencere gizlenince de kapanır', () => {
    const open = { shown: true, armed: true };
    expect(nextSaverState(open, { ...base, idleSeconds: 1 }).shown).toBe(false);
    expect(nextSaverState(open, { ...base, idleSeconds: 400, mainVisible: false }).shown).toBe(false);
    expect(nextSaverState(open, { ...base, idleSeconds: 400 }).shown).toBe(true);
  });
});

describe('makeMotes', () => {
  it('istenen sayıda üretir', () => {
    expect(makeMotes(12, () => 0.5)).toHaveLength(12);
  });
});
