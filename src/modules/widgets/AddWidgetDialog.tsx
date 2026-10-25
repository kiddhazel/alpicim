import { LayoutDashboard, X } from 'lucide-react';
import { useEffect } from 'react';
import { t } from '../../i18n';
import { setOverlay } from '../../shared/lib/overlay';
import { IconButton } from '../../shared/ui/primitives';
import { WIDGETS } from './registry';
import type { WidgetType } from './types';

export function AddWidgetDialog({ onAdd, onClose }: { onAdd: (type: WidgetType) => void; onClose: () => void }) {
  useEffect(() => {
    setOverlay('add-widget', true);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      setOverlay('add-widget', false);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6 backdrop-blur-md pt-[10vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={t('widgets.add')}
        className="w-full max-w-xl glass overflow-hidden rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <LayoutDashboard size={18} className="text-accent" />
          <h2 className="flex-1 text-md font-semibold">{t('widgets.add')}</h2>
          <IconButton size="sm" icon={X} label={t('common.close')} onClick={onClose} />
        </div>
        <ul className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto p-4 pt-1 sm:grid-cols-2">
          {WIDGETS.map((def) => {
            const Icon = def.icon;
            return (
              <li key={def.type}>
                <button
                  type="button"
                  onClick={() => onAdd(def.type)}
                  className="flex w-full items-start gap-3 rounded-2xl bg-surface-2 p-3 text-left transition-colors hover:bg-surface-3"
                >
                  <Icon size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <span className="block text-base font-medium">{t(def.titleKey)}</span>
                    <span className="block text-sm text-muted">{t(def.descriptionKey)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
