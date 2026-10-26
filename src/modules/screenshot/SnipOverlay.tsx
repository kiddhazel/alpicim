import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { dragRect, isUsable, toFractions, type Point, type Rect } from './snip';
import { screenshotService } from './screenshotService';

/** "snip" penceresi: saydam tam ekran; sürükleyerek bölge seçilir, Esc iptal eder. */
export function SnipOverlay() {
  const [rect, setRect] = useState<Rect | null>(null);
  const start = useRef<Point | null>(null);
  const done = useRef(false);

  useEffect(() => {
    // Laila penceresiyle aynı: gövde arka planı tamamen saydam.
    document.documentElement.classList.add('laila-window');
    return () => document.documentElement.classList.remove('laila-window');
  }, []);

  const bounds = () => ({ w: window.innerWidth, h: window.innerHeight });

  const cancel = () => {
    if (done.current) return;
    done.current = true;
    void screenshotService.cancel();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const finish = (r: Rect) => {
    if (done.current) return;
    const fr = toFractions(r, bounds());
    if (!fr || !isUsable(r)) {
      setRect(null);
      return;
    }
    done.current = true;
    void screenshotService.finish(fr).catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 cursor-crosshair select-none"
      onPointerDown={(e) => {
        if (e.button === 2) return cancel();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY };
        setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
      }}
      onPointerMove={(e) => {
        if (start.current) setRect(dragRect(start.current, { x: e.clientX, y: e.clientY }, bounds()));
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (s) finish(dragRect(s, { x: e.clientX, y: e.clientY }, bounds()));
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!rect && <div className="absolute inset-0 bg-black/40" />}
      {rect && (
        <div
          className="pointer-events-none absolute border-2 border-white/90"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxShadow: '0 0 0 100vmax rgba(0,0,0,0.45)' }}
        >
          <span className="absolute -top-7 left-0 rounded-md bg-black/70 px-2 py-0.5 text-xs text-white tabular-nums">
            {t('screenshot.size', { w: Math.round(rect.w), h: Math.round(rect.h) })}
          </span>
        </div>
      )}
      {!rect && (
        <p className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-xl bg-black/70 px-4 py-2 text-sm text-white">
          {t('screenshot.hint')}
        </p>
      )}
    </div>
  );
}
