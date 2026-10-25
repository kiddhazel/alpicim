import { ArrowLeftRight } from 'lucide-react';
import { useMemo } from 'react';
import { t } from '../../../i18n';
import { useNow } from '../../../shared/lib/hooks';
import { formatNumber, formatRelative } from '../../../shared/lib/time';
import { Badge, cx, IconButton, Select, TextInput } from '../../../shared/ui/primitives';
import { StateView } from '../../../shared/ui/StateView';
import { KIND_BADGE } from '../../markets/kindBadge';
import { useMarkets } from '../../markets/useMarkets';
import { useSettings } from '../../settings/settings';
import type { WidgetProps } from '../types';
import { convert, parseAmount, ratesFromQuotes, type ConverterConfig } from './converter';

export { converterDefaults, sanitizeConverter } from './converter';

function digits(v: number): number {
  return v >= 100 ? 2 : 4;
}

/**
 * Döviz çevirici. Yalnızca TCMB gösterge kurları (veri türü: referans) kullanılır; piyasa/demo verisi karışmaz.
 * Kur yoksa rakam gösterilmez.
 */
export function ConverterWidget({ config, setConfig, size }: WidgetProps<ConverterConfig>) {
  const [settings] = useSettings();
  const m = useMarkets(settings.marketsRefreshSeconds * (settings.performanceMode ? 2 : 1));
  const now = useNow(60_000);
  const reference = m.cache.reference;
  const rates = useMemo(() => ratesFromQuotes(reference?.data ?? []), [reference]);
  const codes = useMemo(() => ['TRY', ...[...rates.keys()].filter((c) => c !== 'TRY').sort()], [rates]);

  if (rates.size === 0) {
    return m.refreshing || !m.loaded ? (
      <StateView compact kind="loading" title={t('common.loading')} />
    ) : (
      <StateView compact kind={m.online ? 'error' : 'offline'} title={t('widgets.converter.noData')} description={t('widgets.converter.noDataBody')} />
    );
  }

  const from = rates.has(config.from) ? config.from : (codes.find((c) => c !== 'TRY') ?? 'TRY');
  const to = rates.has(config.to) && config.to !== from ? config.to : from === 'TRY' ? (codes[1] ?? 'TRY') : 'TRY';
  const amount = parseAmount(config.amount);
  const result = amount === null ? null : convert(amount, from, to, rates);
  const unit = convert(1, from, to, rates);
  const asOf = reference?.data.find((q) => q.kind === 'reference')?.asOf ?? reference?.fetchedAt ?? null;
  const badge = KIND_BADGE.reference;
  const big = size.h >= 3;

  return (
    <div className="flex h-full flex-col justify-between gap-2 px-4 pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <TextInput
          value={config.amount}
          inputMode="decimal"
          maxLength={24}
          onChange={(e) => setConfig({ amount: e.target.value })}
          aria-label={t('widgets.converter.amount')}
          aria-invalid={amount === null}
          className="tabular w-28 min-w-0 flex-1 text-right"
        />
        <Select value={from} onChange={(e) => setConfig({ from: e.target.value })} aria-label={t('widgets.converter.from')}>
          {codes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <IconButton size="sm" icon={ArrowLeftRight} label={t('widgets.converter.swap')} onClick={() => setConfig({ from: to, to: from })} />
        <Select value={to} onChange={(e) => setConfig({ to: e.target.value })} aria-label={t('widgets.converter.to')}>
          {codes
            .filter((c) => c !== from)
            .map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
        </Select>
      </div>
      <div className="min-w-0">
        {result === null ? (
          <p className="text-sm text-warn">{t('widgets.converter.invalid')}</p>
        ) : (
          <p className={cx('truncate font-display font-semibold tabular', big ? 'text-3xl' : 'text-2xl')} title={`${formatNumber(result, 6)} ${to}`}>
            {formatNumber(result, digits(result))}
            <span className="ml-1.5 text-base font-normal text-muted">{to}</span>
          </p>
        )}
        {unit !== null && (
          <p className="truncate text-xs text-faint tabular">
            1 {from} = {formatNumber(unit, 4)} {to}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-faint" title={t('widgets.converter.note')}>
        <Badge tone={badge.tone}>{t(badge.key)}</Badge>
        <span className="truncate">{t('widgets.converter.source', { time: formatRelative(asOf, now) })}</span>
      </div>
    </div>
  );
}
