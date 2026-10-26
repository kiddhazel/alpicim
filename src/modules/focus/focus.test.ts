import { describe, expect, it } from 'vitest';
import { applyPomodoroSignal, DEFAULT_FOCUS, remainingLabel, sanitizeFocus, setManual, toastAllowed } from './focus';

describe('focus', () => {
  it('bozuk veriyi varsayılana döndürür', () => {
    expect(sanitizeFocus(null)).toEqual(DEFAULT_FOCUS);
    expect(sanitizeFocus({ on: 'x', dim: 3 })).toEqual(DEFAULT_FOCUS);
    expect(sanitizeFocus({ on: false, endsAt: 5, auto: true }).endsAt).toBeNull();
  });

  it('pomodoro çalışma evresi odağı açar, durunca kapatır', () => {
    const on = applyPomodoroSignal(DEFAULT_FOCUS, { phase: 'work', endsAt: 1000 });
    expect(on).toMatchObject({ on: true, auto: true, endsAt: 1000 });
    expect(applyPomodoroSignal(on, { phase: 'work', endsAt: 1000 })).toBe(on);
    const off = applyPomodoroSignal(on, { phase: 'work', endsAt: null });
    expect(off).toMatchObject({ on: false, auto: false, endsAt: null });
    expect(applyPomodoroSignal(on, { phase: 'break', endsAt: 2000 }).on).toBe(false);
  });

  it('otomatik açma kapalıysa dokunmaz; elle açılan kendiliğinden kapanmaz', () => {
    const noAuto = { ...DEFAULT_FOCUS, autoPomodoro: false };
    expect(applyPomodoroSignal(noAuto, { phase: 'work', endsAt: 1 })).toBe(noAuto);
    const manual = setManual(DEFAULT_FOCUS, true);
    const withTimer = applyPomodoroSignal(manual, { phase: 'work', endsAt: 9 });
    expect(withTimer).toMatchObject({ on: true, auto: false, endsAt: 9 });
    expect(applyPomodoroSignal(withTimer, { phase: 'break', endsAt: null })).toMatchObject({ on: true, endsAt: null });
  });

  it('kalan süre ve bildirim süzgeci', () => {
    expect(remainingLabel(null, 0)).toBeNull();
    expect(remainingLabel(125_000, 0)).toBe('02:05');
    expect(remainingLabel(1000, 5000)).toBe('00:00');
    expect(toastAllowed('info', { on: true, suppressToasts: true })).toBe(false);
    expect(toastAllowed('error', { on: true, suppressToasts: true })).toBe(true);
    expect(toastAllowed('success', { on: false, suppressToasts: true })).toBe(true);
  });
});
