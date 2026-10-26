import { Eye, EyeOff, GripVertical, Lock, LockOpen, Settings2, Trash2, X } from 'lucide-react';
import { memo, useCallback, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { t } from '../../i18n';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { cx, IconButton } from '../../shared/ui/primitives';
import { widgetDef } from './registry';
import type { WidgetInstance, WidgetType } from './types';

interface Props {
  widget: WidgetInstance;
  style: CSSProperties;
  editing: boolean;
  dragging: boolean;
  /** Pencere görünür mü (görünmüyorsa widget yenileme yapmaz). */
  pageVisible: boolean;
  onConfig: (id: string, patch: Record<string, unknown>) => void;
  onPatch: (id: string, patch: Partial<WidgetInstance>) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string, mode: 'move' | 'resize', e: ReactPointerEvent) => void;
}

/** Widget türüne göre vurgu rengi (başlık simgesi ve kartın üst tonu). */
const HUES: Record<WidgetType, string> = {
  clock: '#a78bfa',
  weather: '#38bdf8',
  system: '#34d399',
  todo: '#fbbf24',
  notes: '#facc15',
  pomodoro: '#fb7185',
  favorites: '#818cf8',
  calendar: '#22d3ee',
  links: '#2dd4bf',
  news: '#fb923c',
  markets: '#4ade80',
  music: '#f472b6',
  windows: '#94a3b8',
  habits: '#f97316',
  countdown: '#c084fc',
  converter: '#10b981',
  quicknote: '#fde047',
};

/** Tek widget çerçevesi: başlık, düzenleme düğmeleri, ayar görünümü ve hata sınırı. */
export const WidgetFrame = memo(function WidgetFrame({
  widget,
  style,
  editing,
  dragging,
  pageVisible,
  onConfig,
  onPatch,
  onRemove,
  onDragStart,
}: Props) {
  const def = widgetDef(widget.type);
  const Icon = def.icon;
  const hue = HUES[widget.type];
  const frameStyle = useMemo<CSSProperties>(
    () => ({
      ...style,
      backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${hue} 8%, transparent), transparent 55%)`,
    }),
    [style, hue],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const config = useMemo(() => def.sanitize(widget.config), [def, widget.config]);
  const setConfig = useCallback((patch: Record<string, unknown>) => onConfig(widget.id, patch), [onConfig, widget.id]);
  const Body = def.Component;
  const SettingsForm = def.Settings;

  return (
    <section
      data-laila-hide
      aria-label={t(def.titleKey)}
      style={frameStyle}
      className={cx(
        'group absolute flex flex-col overflow-hidden rounded-2xl bg-surface-2 shadow-[inset_0_0_0_1px_var(--glass-edge)] transition-colors hover:bg-surface-3',
        dragging && 'z-20 shadow-panel ring-2 ring-accent',
        widget.disabled && 'opacity-60',
      )}
    >
      <header
        className={cx('flex h-9 shrink-0 items-center gap-2 pr-1.5 pl-3.5 select-none', editing && !widget.locked && 'cursor-grab active:cursor-grabbing')}
        onPointerDown={(e) => editing && !widget.locked && onDragStart(widget.id, 'move', e)}
      >
        {editing && !widget.locked && <GripVertical size={14} className="text-faint" aria-hidden />}
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
          style={{ color: hue, backgroundColor: `color-mix(in srgb, ${hue} 16%, transparent)` }}
        >
          <Icon size={14} strokeWidth={1.75} />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-fg/80">{t(def.titleKey)}</h3>
        {widget.locked && !editing && <Lock size={12}className="text-faint" aria-label={t('widgets.locked')} />}
        {SettingsForm && !widget.disabled && (
          <IconButton
            size="sm"
            icon={settingsOpen ? X : Settings2}
            label={settingsOpen ? t('common.close') : t('widgets.settings')}
            onClick={() => setSettingsOpen((o) => !o)}
            className={cx('h-7 w-7', !editing && !settingsOpen && 'opacity-0 group-hover:opacity-100 focus:opacity-100')}
          />
        )}
        {editing && (
          <>
            <IconButton
              size="sm"
              icon={widget.locked ? Lock : LockOpen}
              active={widget.locked}
              label={widget.locked ? t('widgets.unlock') : t('widgets.lock')}
              onClick={() => onPatch(widget.id, { locked: !widget.locked })}
              className="h-7 w-7"
            />
            <IconButton
              size="sm"
              icon={widget.disabled ? Eye : EyeOff}
              label={widget.disabled ? t('widgets.enable') : t('widgets.disable')}
              onClick={() => onPatch(widget.id, { disabled: !widget.disabled })}
              className="h-7 w-7"
            />
            <IconButton size="sm" tone="danger" icon={Trash2} label={t('widgets.remove')} onClick={() => onRemove(widget.id)} className="h-7 w-7" />
          </>
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        {widget.disabled ? (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-faint">{t('widgets.disabledBody')}</p>
        ) : settingsOpen && SettingsForm ? (
          <div className="h-full overflow-y-auto px-4 py-2">
            <SettingsForm config={config} setConfig={setConfig} />
          </div>
        ) : (
          <ErrorBoundary compact resetKey={widget.config}>
            <Body id={widget.id} config={config} setConfig={setConfig} size={{ w: widget.w, h: widget.h }} active={pageVisible} />
          </ErrorBoundary>
        )}
      </div>
      {editing && !widget.locked && (
        <div
          role="separator"
          aria-label={t('widgets.resize')}
          title={t('widgets.resize')}
          onPointerDown={(e) => onDragStart(widget.id, 'resize', e)}
          className="absolute right-0 bottom-0 h-4 w-4 cursor-se-resize"
          style={{ background: 'linear-gradient(135deg, transparent 50%, var(--border-strong) 50%)' }}
        />
      )}
    </section>
  );
});
