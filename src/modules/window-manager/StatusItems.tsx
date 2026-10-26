import { Briefcase, ChevronsUpDown, Home, Music2, Newspaper, Star, type LucideIcon } from 'lucide-react';
import { t } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { cx } from '../../shared/ui/primitives';
import { Menu } from '../../shared/ui/overlays';
import { useSettings } from '../settings/settings';
import type { Workspace, WorkspaceIcon } from '../workspaces/workspaces';

export const WORKSPACE_ICONS: Record<WorkspaceIcon, LucideIcon> = {
  home: Home,
  briefcase: Briefcase,
  newspaper: Newspaper,
  music: Music2,
  star: Star,
};

/** Kenar çubuğunun üstündeki çalışma alanı seçici (Ctrl+1…9 ile de geçilir). */
export function WorkspaceSwitcher({
  items,
  activeId,
  onSwitch,
  collapsed,
}: {
  items: Workspace[];
  activeId: string;
  onSwitch: (id: string) => void;
  collapsed: boolean;
}) {
  const active = items.find((w) => w.id === activeId) ?? items[0];
  if (!active) return null;
  const ActiveIcon = WORKSPACE_ICONS[active.icon];
  return (
    <Menu
      width={216}
      trigger={
        <button
          type="button"
          title={`${t('shell.workspace')}: ${active.name}`}
          aria-label={`${t('shell.workspace')}: ${active.name}`}
          className={cx(
            'flex h-9 items-center gap-2.5 rounded-lg bg-control text-sm text-fg shadow-[inset_0_0_0_1px_var(--stroke)] transition-colors duration-150 hover:bg-control-hover',
            collapsed ? 'w-10 justify-center self-center' : 'w-full px-3',
          )}
        >
          <ActiveIcon size={16} strokeWidth={1.75} className="shrink-0 text-fg-2" />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-left">{active.name}</span>
              <ChevronsUpDown size={14} strokeWidth={1.75} className="shrink-0 text-fg-3" />
            </>
          )}
        </button>
      }
      items={items.map((w, i) => ({
        label: w.name,
        icon: WORKSPACE_ICONS[w.icon],
        shortcut: i < 9 ? `Ctrl+${i + 1}` : undefined,
        onSelect: () => onSwitch(w.id),
      }))}
    />
  );
}

const DATE = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });

/** Durum çubuğu saati ve tarihi. */
export function MiniClock() {
  const [settings] = useSettings();
  const now = useNow(settings.performanceMode ? 30_000 : 5_000);
  const d = new Date(now);
  return (
    <div className="flex shrink-0 items-baseline gap-2" title={d.toLocaleString('tr-TR')}>
      <span className="hidden text-xs text-fg-2 lg:inline">{DATE.format(d)}</span>
      <span className="tabular text-xs text-fg">{d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  );
}
