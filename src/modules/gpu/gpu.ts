import { AppError, call } from '../../shared/lib/tauri';

/** Rust → GpuStats (nvidia-smi); okunamayan değerler null. */
export interface GpuStats {
  name: string;
  temperature: number | null;
  utilization: number | null;
  /** MiB */
  memoryUsed: number | null;
  memoryTotal: number | null;
  /** Watt */
  power: number | null;
  fan: number | null;
}

export const GPU_HISTORY = 60;

export function pushSample(history: readonly number[], value: number | null, max = GPU_HISTORY): number[] {
  if (value === null || !Number.isFinite(value)) return history.slice(-max);
  return [...history, value].slice(-max);
}

export function tempTone(temp: number | null): 'ok' | 'warn' | 'hot' {
  if (temp === null) return 'ok';
  return temp >= 85 ? 'hot' : temp >= 75 ? 'warn' : 'ok';
}

/** Değer dizisini SVG polyline noktalarına çevirir (min..max → alt..üst). */
export function sparkPoints(values: readonly number[], width: number, height: number, min = 0, max = 100): string {
  if (values.length < 2) return '';
  const span = Math.max(1, max - min);
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((Math.min(max, Math.max(min, v)) - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function memoryPercent(used: number | null, total: number | null): number | null {
  if (used === null || total === null || total <= 0) return null;
  return Math.min(100, Math.round((used / total) * 100));
}

export function formatMiB(mib: number): string {
  return mib >= 1024 ? `${(mib / 1024).toFixed(1)} GB` : `${Math.round(mib)} MB`;
}

export function isNoDriver(err: unknown): boolean {
  const text = err instanceof AppError ? `${err.detail ?? ''} ${err.message}` : String(err);
  return text.includes('NO_DRIVER');
}

export const gpuService = {
  stats: () => call<GpuStats>('gpu_stats'),
};
