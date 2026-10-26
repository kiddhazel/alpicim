import { X, type LucideIcon } from 'lucide-react';
import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n';
import { setOverlay } from '../lib/overlay';
import { cx, IconButton } from './primitives';

/* Açılır katmanlar (Tooltip, Menu, Dialog): portal + sabit konum; yerel yüzeylerin üstünde kalmak için setOverlay çağırır. */

const POP = 'bg-card shadow-[inset_0_0_0_1px_var(--stroke-strong),var(--shadow-pop)]';

/* ───────────── Tooltip ───────────── */

export function Tooltip({
  text,
  side = 'top',
  children,
}: {
  text: string;
  side?: 'top' | 'bottom';
  children: ReactElement<Record<string, unknown>>;
}) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setPos({ x: r.left + r.width / 2, y: side === 'top' ? r.top - 6 : r.bottom + 6 });
    }, 350);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setPos(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span ref={ref} className="inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {cloneElement(children, { 'aria-describedby': pos ? id : undefined, title: undefined })}
      {pos &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{ left: pos.x, top: pos.y, transform: `translate(-50%, ${side === 'top' ? '-100%' : '0'})` }}
            className={cx('pointer-events-none fixed z-[1000] whitespace-nowrap rounded-md px-2 py-1 text-xs text-fg', POP)}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}

/* ───────────── Menu ───────────── */

export type MenuItem =
  | { type?: 'item'; label: string; icon?: LucideIcon; shortcut?: string; danger?: boolean; disabled?: boolean; onSelect: () => void }
  | { type: 'separator' };

export function Menu({
  trigger,
  items,
  align = 'start',
  width = 220,
}: {
  trigger: ReactElement<Record<string, unknown>>;
  items: readonly MenuItem[];
  align?: 'start' | 'end';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const wrap = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const key = useId();

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) return;
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const x = align === 'end' ? r.right - width : r.left;
    setPos({ x: Math.max(8, Math.min(x, window.innerWidth - width - 8)), y: r.bottom + 4 });
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return;
    setOverlay(key, true);
    panel.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !wrap.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      setOverlay(key, false);
    };
  }, [open, key, close]);

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      wrap.current?.querySelector<HTMLElement>('button')?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const nodes = [...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  return (
    <span ref={wrap} className="inline-flex" onClick={() => setOpen((o) => !o)}>
      {cloneElement(trigger, { 'aria-haspopup': 'menu', 'aria-expanded': open })}
      {open &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            onKeyDown={onKey}
            onClick={(e) => e.stopPropagation()}
            style={{ left: pos.x, top: pos.y, width }}
            className={cx('fixed z-[1000] rounded-xl p-1', POP)}
          >
            {items.map((item, i) =>
              item.type === 'separator' ? (
                <div key={i} role="separator" className="my-1 h-px bg-stroke" />
              ) : (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                  className={cx(
                    'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm outline-none transition-colors disabled:opacity-40',
                    item.danger
                      ? 'text-down hover:bg-down/12 focus:bg-down/12'
                      : 'text-fg hover:bg-control-hover focus:bg-control-hover',
                  )}
                >
                  {item.icon && <item.icon size={16} strokeWidth={1.75} className={item.danger ? undefined : 'text-fg-2'} />}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.shortcut && <span className="text-xs text-fg-3">{item.shortcut}</span>}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

/* ───────────── Dialog ───────────── */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const key = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setOverlay(key, true);
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      setOverlay(key, false);
      prev?.focus?.();
    };
  }, [open, key, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-overlay p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width }}
        className={cx('max-h-full max-w-full overflow-auto rounded-xl', POP)}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
            {description && <p className="mt-1 text-sm text-fg-2">{description}</p>}
          </div>
          <IconButton icon={X} label={t('common.close')} size="sm" onClick={onClose} />
        </div>
        {children && <div className="px-5 pt-4">{children}</div>}
        {footer && <div className="mt-5 flex justify-end gap-2 border-t border-stroke bg-layer px-5 py-3">{footer}</div>}
        {!footer && <div className="h-5" />}
      </div>
    </div>,
    document.body,
  );
}
