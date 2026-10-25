import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { t } from '../../i18n';
import { cx } from './primitives';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: Tone;
  text: string;
}

interface ToastApi {
  push: (tone: Tone, text: string) => void;
}

const ToastContext = createContext<ToastApi>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((i) => i.id !== id)), []);

  const push = useCallback(
    (tone: Tone, text: string) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, tone, text }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3000);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-3 bottom-3 z-50 flex w-80 max-w-[calc(100vw-24px)] flex-col gap-2">
        {items.map((item) => {
          const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertTriangle : Info;
          return (
            <div
              key={item.id}
              role={item.tone === 'error' ? 'alert' : 'status'}
              className="glass pointer-events-auto flex items-start gap-2 rounded-2xl px-3.5 py-3"
            >
              <Icon
                size={16}
                className={cx(
                  'mt-px shrink-0',
                  item.tone === 'success' ? 'text-up' : item.tone === 'error' ? 'text-down' : 'text-accent',
                )}
              />
              <p className="selectable flex-1 text-sm text-fg">{item.text}</p>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={() => dismiss(item.id)}
                className="text-faint hover:text-fg"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
