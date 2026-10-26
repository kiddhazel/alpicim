import { useEffect, useRef } from 'react';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import {
  applyPomodoroSignal,
  DEFAULT_FOCUS,
  FOCUS_KEY,
  POMODORO_SIGNAL_EVENT,
  sanitizeFocus,
  setManual,
  type FocusState,
  type PomodoroSignal,
} from './focus';

export function useFocus() {
  const [state, setState, loaded] = usePersistentState<FocusState>(FOCUS_KEY, DEFAULT_FOCUS, sanitizeFocus);
  return { focus: state, setFocus: setState, toggle: () => setState((s) => setManual(s, !s.on)), loaded };
}

/** Pomodoro widget'ı durumunu bildirir (odak modu dinler; widget odak modunu bilmez). */
export function signalPomodoro(signal: PomodoroSignal) {
  window.dispatchEvent(new CustomEvent<PomodoroSignal>(POMODORO_SIGNAL_EVENT, { detail: signal }));
}

/**
 * Kök öznitelikleri: `data-focus="on|off"`, `data-focus-dim`, `data-focus-toasts`. Her pencerede (App) çağrılır;
 * CSS/bileşenler öznitelikleri okur. Pomodoro sinyallerini de burada işler.
 */
export function useApplyFocus() {
  const { focus, setFocus, loaded } = useFocus();
  const ref = useRef(focus);
  ref.current = focus;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.focus = focus.on ? 'on' : 'off';
    root.dataset.focusDim = focus.on && focus.dim ? 'on' : 'off';
    root.dataset.focusToasts = focus.on && focus.suppressToasts ? 'off' : 'on';
  }, [focus.on, focus.dim, focus.suppressToasts]);

  useEffect(() => {
    if (!loaded) return;
    const onSignal = (e: Event) => {
      const next = applyPomodoroSignal(ref.current, (e as CustomEvent<PomodoroSignal>).detail);
      if (next !== ref.current) setFocus(next);
    };
    window.addEventListener(POMODORO_SIGNAL_EVENT, onSignal);
    return () => window.removeEventListener(POMODORO_SIGNAL_EVENT, onSignal);
  }, [loaded, setFocus]);
}

/** Odak açık mı? (animasyon sakinleştirme için hafif okuma) */
export function useFocusOn(): boolean {
  return useFocus().focus.on;
}
