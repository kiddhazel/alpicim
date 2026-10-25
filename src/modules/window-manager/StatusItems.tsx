import { Briefcase, Home, Music2, Newspaper, Star, type LucideIcon } from 'lucide-react';
import { t } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { cx } from '../../shared/ui/primitives';
import { useSettings } from '../settings/settings';
import type { Workspace, WorkspaceIcon } from '../workspaces/workspaces';

export const WORKSPACE_ICONS: Record<WorkspaceIcon, LucideIcon> = {
  home: Home,
  briefcase: Briefcase,
  newspaper: Newspaper,
  music: Music2,
  star: Star,
};

/** Üst çubuktaki çalışma alanı sekmeleri (Ctrl+1…9 ile de geçilir). */
export function WorkspaceTabs({ items, activeId, onSwitch }: { items: Workspace[]; activeId: string; onSwitch: (id: string) => void }) {
  return (
    <div role="tablist" aria-label={t('workspaces.title')} className="glass flex min-w-0 items-center gap-1 overflow-x-auto rounded-2xl p-1">
      {items.map((w, i) => {
        const Icon = WORKSPACE_ICONS[w.icon];
        const active = w.id === activeId;
        return (
          <button
            key={w.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={i < 9 ? `${w.name} (Ctrl+${i + 1})` : w.name}
            onClick={() => onSwitch(w.id)}
            className={cx(
              'flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm transition-all',
              active ? 'bg-surface-3 text-fg shadow-[0_0_20px_-8px_var(--accent)]' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <Icon size={16} strokeWidth={1.75} />
            <span className="max-w-32 truncate">{w.name}</span>
          </button>
        );
      })}
    </div>
  );
}

const DATE = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });

/** Mini kontrol merkezi: saat ve tarih. */
export function MiniClock() {
  const [settings] = useSettings();
  const now = useNow(settings.performanceMode ? 30_000 : 5_000);
  const d = new Date(now);
  return (
    <div className="flex shrink-0 items-baseline gap-2 px-1" title={d.toLocaleString('tr-TR')}>
      <span className="tabular font-display text-lg font-semibold">{d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="hidden text-sm text-muted lg:inline">{DATE.format(d)}</span>
    </div>
  );
}
