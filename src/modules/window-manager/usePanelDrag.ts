import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { setOverlay } from '../../shared/lib/overlay';
import { isPanelId, type PanelId } from './panels';

export interface PanelDragState {
  panel: PanelId;
  x: number;
  y: number;
  over: PanelId | null;
}

/** Sürükleme başlamadan önce farenin gitmesi gereken mesafe (tıklamayı sürüklemeden ayırmak için). */
const THRESHOLD = 6;

/**
 * İşaretçi (pointer) olaylarıyla panel sürükle-bırak. HTML5 DnD yerine bunu kullanıyoruz çünkü:
 * - Windows'ta Tauri'nin dosya bırakma işleyicisi HTML5 DnD'yi engelleyebilir,
 * - sürükleme sırasında yerel tarayıcı webview'i gizlenmeli (overlay).
 * Bırakılan hedef `data-panel-drop="<id>"` özniteliğiyle bulunur.
 */
export function usePanelDrag(onDrop: (from: PanelId, to: PanelId) => void) {
  const [drag, setDrag] = useState<PanelDragState | null>(null);
  const pending = useRef<{ panel: PanelId; x: number; y: number } | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const targetAt = (x: number, y: number): PanelId | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const id = (el as HTMLElement).closest?.('[data-panel-drop]')?.getAttribute('data-panel-drop');
      if (isPanelId(id)) return id;
    }
    return null;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      if (!drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) < THRESHOLD) return;
      setOverlay('panel-drag', true);
      setDrag({ panel: p.panel, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY) });
    };
    const up = (e: PointerEvent) => {
      const p = pending.current;
      pending.current = null;
      if (!p) return;
      // Not: durum güncelleyicisinin içinde yan etki yapılmaz (StrictMode iki kez çağırır).
      if (drag) {
        const over = targetAt(e.clientX, e.clientY);
        if (over && over !== p.panel) onDropRef.current(p.panel, over);
      }
      setDrag(null);
      setOverlay('panel-drag', false);
    };
    const cancel = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pending.current) {
        pending.current = null;
        setDrag(null);
        setOverlay('panel-drag', false);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', cancel);
    };
  }, [drag]);

  /** Panel başlığının onPointerDown'una bağlanır; düğmelere tıklamalar sürükleme başlatmaz. */
  const startDrag = useCallback((panel: PanelId, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, a, select')) return;
    e.preventDefault();
    pending.current = { panel, x: e.clientX, y: e.clientY };
  }, []);

  return { drag, startDrag };
}
