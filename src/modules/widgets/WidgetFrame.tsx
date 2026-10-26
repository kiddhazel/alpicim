import { Eye, EyeOff, GripVertical, Lock, LockOpen, Settings2, Trash2, X } from 'lucide-react';
import { memo, useCallback, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { t } from '../../i18n';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { Card, CardHeader, cx, IconButton } from '../../shared/ui/primitives';
import { widgetDef } from './registry';
import type { WidgetInstance } from './types';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const config = useMemo(() => def.sanitize(widget.config), [def, widget.config]);
  const setConfig = useCallback((patch: Record<string, unknown>) => onConfig(widget.id, patch), [onConfig, widget.id]);
  const Body = def.Component;
  const SettingsForm = def.Settings;

  return (
    <Card
      role="region"
      data-laila-hide
      aria-label={t(def.titleKey)}
      style={style}
      className={cx(
        'group absolute z-10 flex flex-col overflow-hidden',
        dragging && 'z-20 shadow-pop ring-2 ring-accent',
        widget.disabled && 'opacity-60',
      )}
    >
      <div
        className={cx('shrink-0 select-none', editing && !widget.locked && 'cursor-grab active:cursor-grabbing')}
        onPointerDown={(e) => editing && !widget.locked && onDragStart(widget.id, 'move', e)}
      >
        <CardHeader
          className="!min-h-10 !pt-2"
          title={
            <span className="flex items-center gap-2">
              {editing && !widget.locked && <GripVertical size={14} className="shrink-0 text-fg-3" aria-hidden />}
              <Icon size={16} strokeWidth={1.75} className="shrink-0 text-fg-2" aria-hidden />
              <span className="truncate">{t(def.titleKey)}</span>
              {widget.locked && !editing && <Lock size={12} className="shrink-0 text-fg-3" aria-label={t('widgets.locked')} />}
            </span>
          }
          actions={
            <>
              {SettingsForm && !widget.disabled && (
                <IconButton
                  size="sm"
                  icon={settingsOpen ? X : Settings2}
                  label={settingsOpen ? t('common.close') : t('widgets.settings')}
                  onClick={() => setSettingsOpen((o) => !o)}
                  className={cx(!editing && !settingsOpen && 'opacity-0 group-hover:opacity-100 focus:opacity-100')}
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
                  />
                  <IconButton
                    size="sm"
                    icon={widget.disabled ? Eye : EyeOff}
                    label={widget.disabled ? t('widgets.enable') : t('widgets.disable')}
                    onClick={() => onPatch(widget.id, { disabled: !widget.disabled })}
                  />
                  <IconButton size="sm" tone="danger" icon={Trash2} label={t('widgets.remove')} onClick={() => onRemove(widget.id)} />
                </>
              )}
            </>
          }
        />
      </div>
      <div className="relative min-h-0 flex-1">
        {widget.disabled ? (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-fg-3">{t('widgets.disabledBody')}</p>
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
          style={{ background: 'linear-gradient(135deg, transparent 50%, var(--stroke-strong) 50%)' }}
        />
      )}
    </Card>
  );
});
