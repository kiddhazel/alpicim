import { t } from '../../../i18n';
import { useNow } from '../../../shared/lib/hooks';
import { Toggle } from '../../../shared/ui/primitives';
import { useSettings } from '../../settings/settings';
import { bool, obj, type WidgetProps, type WidgetSettingsProps } from '../types';

export interface ClockConfig {
  showSeconds: boolean;
  showDate: boolean;
}

export const clockDefaults: ClockConfig = { showSeconds: true, showDate: true };

export function sanitizeClock(raw: unknown): ClockConfig {
  const r = obj(raw);
  return { showSeconds: bool(r.showSeconds, true), showDate: bool(r.showDate, true) };
}

const DATE = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function ClockWidget({ config, size }: WidgetProps<ClockConfig>) {
  const [settings] = useSettings();
  // Performans modunda saniye gösterilmez ve dakikada bir çizilir.
  const seconds = config.showSeconds && !settings.performanceMode;
  const now = useNow(seconds ? 1000 : 15_000);
  const d = new Date(now);
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined });
  const big = size.h >= 3 || size.w >= 6;
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <p className={big ? 'text-gradient font-display tabular text-6xl leading-none font-semibold tracking-tight' : 'text-gradient font-display tabular text-5xl leading-none font-semibold'}>{time}</p>
      {config.showDate && <p className="mt-2 truncate text-sm text-muted">{DATE.format(d)}</p>}
    </div>
  );
}

export function ClockSettings({ config, setConfig }: WidgetSettingsProps<ClockConfig>) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex items-center justify-between">
        {t('widgets.clock.seconds')}
        <Toggle checked={config.showSeconds} label={t('widgets.clock.seconds')} onChange={(v) => setConfig({ showSeconds: v })} />
      </label>
      <label className="flex items-center justify-between">
        {t('widgets.clock.date')}
        <Toggle checked={config.showDate} label={t('widgets.clock.date')} onChange={(v) => setConfig({ showDate: v })} />
      </label>
    </div>
  );
}
