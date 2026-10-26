import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../../i18n';
import { useInterval } from '../../../shared/lib/hooks';
import { isTauri } from '../../../shared/lib/tauri';
import { cx } from '../../../shared/ui/primitives';
import { describeError, StateView } from '../../../shared/ui/StateView';
import {
  formatMiB,
  gpuService,
  isNoDriver,
  memoryPercent,
  pushSample,
  sparkPoints,
  tempTone,
  type GpuStats,
} from '../../gpu/gpu';
import type { WidgetProps } from '../types';

export type GpuConfig = Record<string, never>;
export const gpuDefaults: GpuConfig = {};
export function sanitizeGpu(): GpuConfig {
  return {};
}

const POLL_MS = 3000;

/** NVIDIA GPU: sıcaklık, kullanım, VRAM, güç, fan + son 3 dakikalık sparkline. Yalnız görünürken yoklar. */
export function GpuWidget({ active }: WidgetProps<GpuConfig>) {
  const [stats, setStats] = useState<GpuStats | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [temps, setTemps] = useState<number[]>([]);
  const [utils, setUtils] = useState<number[]>([]);
  const busy = useRef(false);

  const pull = useCallback(() => {
    if (!isTauri() || busy.current) return;
    busy.current = true;
    gpuService
      .stats()
      .then((s) => {
        setStats(s);
        setError(null);
        setTemps((h) => pushSample(h, s.temperature));
        setUtils((h) => pushSample(h, s.utilization));
      })
      .catch(setError)
      .finally(() => {
        busy.current = false;
      });
  }, []);

  useEffect(() => {
    if (active) pull();
  }, [active, pull]);
  useInterval(pull, active && !(error && isNoDriver(error)) ? POLL_MS : null);

  if (!isTauri()) return <StateView compact kind="desktop" title={t('errors.desktopTitle')} />;
  if (error && isNoDriver(error)) return <StateView compact kind="empty" title={t('widgets.gpu.noDriver')} />;
  if (!stats) {
    return error ? (
      <StateView compact kind="error" title={t('widgets.gpu.failed')} description={describeError(error).description} />
    ) : (
      <StateView compact kind="loading" title={t('common.loading')} />
    );
  }

  const tone = tempTone(stats.temperature);
  const vram = memoryPercent(stats.memoryUsed, stats.memoryTotal);
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-4 py-2">
      <p className="truncate text-xs text-fg-3" title={stats.name}>
        {stats.name}
      </p>
      <div className="flex items-end gap-4">
        <Stat
          label={t('widgets.gpu.temp')}
          value={stats.temperature === null ? '—' : `${Math.round(stats.temperature)}°C`}
          className={tone === 'hot' ? 'text-down' : tone === 'warn' ? 'text-warn' : 'text-fg'}
        />
        <Stat label={t('widgets.gpu.util')} value={stats.utilization === null ? '—' : `%${Math.round(stats.utilization)}`} />
        <Stat label={t('widgets.gpu.power')} value={stats.power === null ? '—' : `${Math.round(stats.power)} W`} />
        <Stat label={t('widgets.gpu.fan')} value={stats.fan === null ? '—' : `%${Math.round(stats.fan)}`} />
      </div>
      <Spark temps={temps} utils={utils} />
      {vram !== null && stats.memoryUsed !== null && stats.memoryTotal !== null && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-fg-3">
            <span>{t('widgets.gpu.vram')}</span>
            <span className="tabular-nums">
              {formatMiB(stats.memoryUsed)} / {formatMiB(stats.memoryTotal)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-control">
            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${vram}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-fg-3">{label}</p>
      <p className={cx('tabular-nums text-lg leading-6 font-semibold', className)}>{value}</p>
    </div>
  );
}

function Spark({ temps, utils }: { temps: number[]; utils: number[] }) {
  const W = 200;
  const H = 36;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-9 w-full" role="img" aria-label={t('widgets.gpu.chart')}>
        <polyline points={sparkPoints(utils, W, H)} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <polyline
          points={sparkPoints(temps, W, H, 20, 100)}
          fill="none"
          stroke="var(--warn)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="flex justify-between text-xs text-fg-3">
        <span className="text-accent">{t('widgets.gpu.util')}</span>
        <span className="text-warn">{t('widgets.gpu.temp')}</span>
      </p>
    </div>
  );
}
