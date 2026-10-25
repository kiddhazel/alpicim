import { useId, useMemo, useState } from 'react';
import { t } from '../../i18n';
import { formatNumber } from '../../shared/lib/time';
import type { PricePoint } from './types';

interface Props {
  points: readonly PricePoint[];
  height?: number;
  /** Eksen etiketleri ve imleç ipucu gösterilsin mi? */
  detailed?: boolean;
  label: string;
  digits?: number;
  /** Alan dolgusu belirgin gradyan olsun (kart sparkline'ı). */
  rich?: boolean;
  /** Dışarıda tanımlı bir <linearGradient> kimliği; verilirse alan bununla doldurulur. */
  fillId?: string;
}

/**
 * Bağımlılıksız SVG çizgi grafiği. Yönü (yükseliş/düşüş) rengiyle değil, ilk-son değer farkıyla belirler;
 * renk ek bilgi olarak kullanılır, sayısal değer her zaman ayrıca yazılır.
 */
export function LineChart({ points, height = 44, detailed = false, label, digits = 4, rich = false, fillId }: Props) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const width = 300;
  const pad = detailed ? { l: 4, r: 4, t: 8, b: 16 } : { l: 1, r: 1, t: 3, b: 3 };

  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.abs(max) * 0.001 || 1;
    const x = (i: number) => pad.l + (i / (points.length - 1)) * (width - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - min) / span) * (height - pad.t - pad.b);
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${height - pad.b} L${x(0).toFixed(1)},${height - pad.b} Z`;
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    return { min, max, x, y, line, area, up: last >= first };
  }, [points, height, pad.l, pad.r, pad.t, pad.b]);

  if (!geo) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-faint" aria-hidden />;
  }

  const color = geo.up ? 'var(--up)' : 'var(--down)';
  const lastPoint = points[points.length - 1];
  const lastTop = lastPoint ? (geo.y(lastPoint.v) / height) * 100 : 0;
  const hp = hover !== null ? points[hover] : undefined;

  return (
    <div className="relative">
      <svg
        role="img"
        aria-label={`${label}: ${formatNumber(points[0]?.v ?? 0, digits)} → ${formatNumber(points[points.length - 1]?.v ?? 0, digits)}`}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
        onMouseMove={
          detailed
            ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                setHover(Math.round(Math.min(1, Math.max(0, ratio)) * (points.length - 1)));
              }
            : undefined
        }
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={rich || detailed ? 0.38 : 0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={geo.area} fill={`url(#${fillId ?? gradientId})`} />
        <path d={geo.line} fill="none" stroke={color} strokeWidth={rich || detailed ? 2.25 : 1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hp && hover !== null && (
          <line
            x1={geo.x(hover)}
            x2={geo.x(hover)}
            y1={pad.t}
            y2={height - pad.b}
            stroke="var(--border-strong)"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {detailed && (
        <div className="tabular mt-0.5 flex justify-between gap-2 text-xs text-faint">
          <span>{points[0]?.t}</span>
          <span>
            {t('wide.chartMin')} {formatNumber(geo.min, digits)} · {t('wide.chartMax')} {formatNumber(geo.max, digits)}
          </span>
          <span>{points[points.length - 1]?.t}</span>
        </div>
      )}
      {detailed && (
        <>
          <span className="tabular pointer-events-none absolute top-0 left-1 text-xs text-faint">{formatNumber(geo.max, digits)}</span>
          <span
            className="tabular pointer-events-none absolute left-1 text-xs text-faint"
            style={{ bottom: pad.b + 22 }}
          >
            {formatNumber(geo.min, digits)}
          </span>
          <span
            className="tabular pointer-events-none absolute right-1 -translate-y-1/2 rounded-md bg-surface-3 px-1.5 py-0.5 text-xs font-medium text-fg"
            style={{ top: `${Math.min(88, Math.max(6, lastTop))}%` }}
            title={t('wide.chartLast')}
          >
            {t('wide.chartLast')} {formatNumber(lastPoint?.v ?? 0, digits)}
          </span>
        </>
      )}
      {detailed && hp && (
        <div className="tabular pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 rounded bg-surface-3 px-1.5 py-0.5 text-xs text-fg">
          {hp.t}: {formatNumber(hp.v, digits)}
        </div>
      )}
    </div>
  );
}
