import { useEffect, useRef, type RefObject } from 'react';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Yerel bir yüzeyin (alt webview, gömülü Windows penceresi) bir HTML öğesinin konumunu izlemesi için.
 * Öğe boyutu, pencere boyutu veya kaydırma değişince `onChange` (bir kare içinde birleştirilmiş) çağrılır.
 * Konum, öğeyi kesen en yakın `main` alanıyla sınırlanır ki başka panellerin üstüne taşmasın.
 */
export function useNativeBounds(ref: RefObject<HTMLElement | null>, onChange: (b: Bounds) => void, deps: readonly unknown[]) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const run = () => {
      const b = measure(el);
      if (b) cb.current(b);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(run);
    };
    run();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function measure(el: HTMLElement): Bounds | null {
  const r = el.getBoundingClientRect();
  const clip = el.closest('main')?.getBoundingClientRect();
  const left = Math.max(r.left, clip?.left ?? r.left);
  const top = Math.max(r.top, clip?.top ?? r.top);
  const right = Math.min(r.right, clip?.right ?? r.right);
  const bottom = Math.min(r.bottom, clip?.bottom ?? r.bottom);
  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.max(0, Math.round(right - left)),
    height: Math.max(0, Math.round(bottom - top)),
  };
}
