import { t } from '../../../i18n';
import { useNow } from '../../../shared/lib/hooks';
import { formatNumber, formatPercent, formatRelative } from '../../../shared/lib/time';
import { Badge, cx } from '../../../shared/ui/primitives';
import { StateView } from '../../../shared/ui/StateView';
import { KIND_BADGE } from '../../markets/kindBadge';
import type { Quote } from '../../markets/types';
import { useMarkets } from '../../markets/useMarkets';
import { useSettings } from '../../settings/settings';
import type { WidgetProps } from '../types';

export type MarketsWidgetConfig = Record<string, never>;

/**
 * Kurlar ve izleme listesi (piyasalar panelinin önbelleği ve sağlayıcılarıyla).
 * Her değerde veri türü etiketi ve zaman gösterilir; veri yoksa sahte rakam gösterilmez.
 */
export function MarketsWidget({ size }: WidgetProps<MarketsWidgetConfig>) {
  const [settings] = useSettings();
  const m = useMarkets(settings.marketsRefreshSeconds * (settings.performanceMode ? 2 : 1));
  const now = useNow(30_000);

  const quotes: Quote[] = [
    ...(m.cache.reference?.data ?? []),
    ...(m.cache.gold?.data ?? []),
    ...(m.cache.live?.data ?? []),
    ...Object.values(m.cache.watch)
      .map((s) => s.data)
      .filter((q): q is Quote => q !== null),
  ];
  // Aynı sembolün referans ve piyasa değeri ayrı satırlarda kalır (veri türleri karışmaz).
  const rows = quotes.slice(0, Math.max(3, size.h * 2 + 1));

  if (rows.length === 0) {
    return m.refreshing || !m.loaded ? (
      <StateView compact kind="loading" title={t('common.loading')} />
    ) : (
      <StateView compact kind={m.online ? 'error' : 'offline'} title={m.online ? t('markets.sectionError') : t('errors.offlineTitle')} />
    );
  }
  return (
    <ul className="h-full divide-y divide-line overflow-y-auto">
      {rows.map((q) => {
        const badge = KIND_BADGE[q.kind];
        const up = (q.changePct ?? 0) > 0;
        const down = (q.changePct ?? 0) < 0;
        return (
          <li key={q.key} className="flex items-center gap-2 px-4 py-2.5" title={`${q.sourceName} · ${formatRelative(q.asOf ?? q.fetchedAt, now)}`}>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{q.label}</span>
            <Badge tone={badge.tone}>{t(badge.key)}</Badge>
            <span className="tabular-nums w-24 text-right text-base font-semibold">
              {formatNumber(q.price, q.price >= 1000 ? 2 : 4)}
            </span>
            <span className={cx('tabular-nums w-16 text-right text-xs', up ? 'text-up' : down ? 'text-down' : 'text-fg-3')}>
              {q.changePct === null ? '—' : formatPercent(q.changePct)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
