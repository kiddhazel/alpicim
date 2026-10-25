import { Cpu, HardDrive, MemoryStick, type LucideIcon } from 'lucide-react';
import { t } from '../../../i18n';
import { cx, TextInput } from '../../../shared/ui/primitives';
import { describeError, StateView } from '../../../shared/ui/StateView';
import { useSettings } from '../../settings/settings';
import { formatBytes, percent, useSystemStats } from '../../system/systemService';
import { num, obj, type WidgetProps, type WidgetSettingsProps } from '../types';

export interface SystemConfig {
  refreshSeconds: number;
}

export const systemDefaults: SystemConfig = { refreshSeconds: 3 };

export function sanitizeSystem(raw: unknown): SystemConfig {
  return { refreshSeconds: num(obj(raw).refreshSeconds, 1, 60, 3) };
}

export function SystemWidget({ config, active }: WidgetProps<SystemConfig>) {
  const [settings] = useSettings();
  const interval = config.refreshSeconds * 1000 * (settings.performanceMode ? 3 : 1);
  const { stats, error } = useSystemStats(interval, active);

  if (!stats) {
    return error ? (
      <StateView compact kind="error" title={t('widgets.system.failed')} description={describeError(error).description} />
    ) : (
      <StateView compact kind="loading" title={t('common.loading')} />
    );
  }
  return (
    <div className="flex h-full flex-col justify-center gap-3 px-4 py-2">
      <Meter icon={Cpu} label={t('widgets.system.cpu')} value={stats.cpu === null ? null : Math.round(stats.cpu)} detail="" />
      <Meter
        icon={MemoryStick}
        label={t('widgets.system.ram')}
        value={percent(stats.memoryUsed, stats.memoryTotal)}
        detail={`${formatBytes(stats.memoryUsed)} / ${formatBytes(stats.memoryTotal)}`}
      />
      <Meter
        icon={HardDrive}
        label={t('widgets.system.disk', { name: stats.diskName })}
        value={percent(stats.diskUsed, stats.diskTotal)}
        detail={`${formatBytes(stats.diskTotal - stats.diskUsed)} ${t('widgets.system.free')}`}
      />
    </div>
  );
}

function Meter({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: number | null; detail: string }) {
  const tone = value === null ? 'bg-surface-3' : value >= 90 ? 'bg-down' : value >= 70 ? 'bg-warn' : 'bg-accent';
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm">
        <Icon size={14} className="text-muted" />
        <span className="text-muted">{label}</span>
        <span className="ml-auto truncate text-xs text-faint">{detail}</span>
        <span className="tabular w-11 text-right text-sm font-semibold">{value === null ? '—' : `%${value}`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div className={cx('h-full rounded-full transition-[width]', tone)} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

export function SystemSettings({ config, setConfig }: WidgetSettingsProps<SystemConfig>) {
  return (
    <label className="flex items-center justify-between text-sm">
      {t('widgets.refreshSeconds')}
      <TextInput
        type="number"
        min={1}
        max={60}
        value={config.refreshSeconds}
        onChange={(e) => setConfig({ refreshSeconds: num(Number(e.target.value), 1, 60, 3) })}
        className="tabular w-20 text-right"
      />
    </label>
  );
}
