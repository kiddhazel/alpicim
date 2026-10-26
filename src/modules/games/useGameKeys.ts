import { useEffect, useRef } from 'react';
import { useActiveView } from '../../shared/lib/hooks';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Panel görünürken ve bir giriş alanına yazılmıyorken tuşları iletir. Handler true dönerse varsayılan engellenir. */
export function useGameKeys(handler: (e: KeyboardEvent) => boolean | void) {
  const active = useActiveView();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (ref.current(e) === true) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
  return active;
}

export type SwipeDir = 'left' | 'right' | 'up' | 'down';

/** Sürükleme/kaydırma algılayıcı: pointer olay özellikleri döndürür. */
export function swipeHandlers(onSwipe: (d: SwipeDir) => void, min = 24) {
  let start: { x: number; y: number } | null = null;
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    },
    onPointerCancel: () => {
      start = null;
    },
  };
}
