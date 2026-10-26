import { KeyRound, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Fragment, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { t } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { formatDateTime, formatNumber, formatPercent, formatRelative } from '../../shared/lib/time';
import { Badge, Button, Card, cx, IconButton, Select, TextInput } from '../../shared/ui/primitives';
import { describeError, StateView } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { useSettings } from '../settings/settings';
import { demoQuotes } from './adapters/demo';
import { tcmbProvider } from './adapters/tcmb';
import { twelveDataProvider } from './adapters/twelvedata';
import { LineChart } from './Chart';
import { watchKey } from './marketService';
import { useElementWidth } from '../news/NewsReader';
import type { PricePoint, Quote, Section, WatchItem } from './types';
import { useMarkets } from './useMarkets';
import { KIND_BADGE } from './kindBadge';

export function MarketsPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [settings] = useSettings();
  const m = useMarkets(settings.marketsRefreshSeconds);
  const now = useNow(30_000);
  const [rootRef, width] = useElementWidth<HTMLDivElement>();
  const wide = width >= WIDE_MIN;
  const [pick, setPick] = useState('USD/TRY');

  const reference = m.cache.reference;
  const lastUpdate = Math.max(
    reference?.fetchedAt ?? 0,
    m.cache.live?.fetchedAt ?? 0,
    m.cache.gold?.fetchedAt ?? 0,
  );

  const refQuotes = reference?.data ?? [];
  const chartQuote = refQuotes.find((q) => q.symbol === pick) ?? refQuotes[0];
  const chartSection = chartQuote ? m.cache.history[chartQuote.symbol] : undefined;

  const firstV = chartSection?.data[0]?.v;
  const lastV = chartSection?.data[chartSection.data.length - 1]?.v;
  const periodPct = firstV && lastV !== undefined && chartSection && chartSection.data.length > 1 ? ((lastV - firstV) / firstV) * 100 : null;

  const watchSection = (
    <>
        {/* 3. İzleme listesi */}
        <section className="mb-6">
          <SectionHead>{t('markets.watchTitle')}</SectionHead>
          <Watchlist
            hasKey={m.hasKey === true}
            items={m.config.watchlist}
            sections={m.cache.watch}
            now={now}
            wide={wide}
            onAdd={(item) => m.setConfig((c) => ({ ...c, watchlist: [...c.watchlist, item] }))}
            onRemove={(key) => m.setConfig((c) => ({ ...c, watchlist: c.watchlist.filter((w) => watchKey(w) !== key) }))}
          />
        </section>    </>
  );

  return (
    <div ref={rootRef} className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 py-2.5">
        <p className="flex-1 text-sm text-fg-2">
          {!m.online
            ? t('markets.offline')
            : lastUpdate
              ? t('markets.updated', { time: formatRelative(lastUpdate, now) })
              : t('markets.loading')}
        </p>
        <IconButton
          icon={RefreshCw}
          label={t('markets.refresh')}
          spin={m.refreshing}
          disabled={m.refreshing}
          onClick={() => void m.refresh(true)}
        />
      </div>

      <div className={wide ? 'flex min-h-0 flex-1 gap-4 px-4 pb-4' : 'min-h-0 flex-1 overflow-y-auto px-4 pb-4'}>
      <div className={wide ? 'min-h-0 min-w-0 flex-1 overflow-y-auto pr-1' : undefined}>
        {/* 1. TCMB referans kurları */}
        <section className="mb-6">
          <SectionHead>{t('markets.referenceTitle')}</SectionHead>
          {!reference && m.refreshing ? (
            <StateView compact kind="loading" title={t('markets.loading')} />
          ) : reference && reference.data.length === 0 && reference.error ? (
            <SectionError section={reference} onRetry={() => void m.refresh(true)} />
          ) : (
            <>
              <QuoteTable>
                {(reference?.data ?? []).map((q) => (
                  <QuoteCard
                    key={q.key}
                    quote={q}
                    now={now}
                    series={m.cache.history[q.symbol]?.data}
                    selected={wide ? chartQuote?.symbol === q.symbol : undefined}
                    onSelect={wide ? () => setPick(q.symbol) : undefined}
                  />
                ))}
              </QuoteTable>
              {wide && chartQuote && (
                <Card className="mt-4 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <h3 className="text-md font-semibold">{chartQuote.symbol}</h3>
                      <span className="sr-only">{t('look.currentValue')}</span>
                      <span className="selectable tabular text-xl font-semibold">
                        {formatNumber(chartQuote.price, chartQuote.price >= 1000 ? 2 : 4)}
                      </span>
                      {periodPct !== null && (
                        <span
                          title={t('look.periodChange')}
                          className={cx(
                            'tabular text-sm font-semibold',
                            periodPct > 0 ? 'text-up' : periodPct < 0 ? 'text-down' : 'text-fg-3',
                          )}
                        >
                          {formatPercent(periodPct)}
                        </span>
                      )}
                      <Badge tone={KIND_BADGE[chartQuote.kind].tone} title={chartQuote.note}>
                        {t(KIND_BADGE[chartQuote.kind].key)}
                      </Badge>
                    </div>
                    <span className="text-xs text-fg-3">
                      {t('wide.chartTitle', { symbol: chartQuote.symbol })} · {t('markets.dailySeries')}
                      {chartSection?.fetchedAt ? ` · ${t('markets.fetched', { time: formatRelative(chartSection.fetchedAt, now) })}` : ''}
                    </span>
                  </div>
                  {chartSection && chartSection.data.length > 1 ? (
                    <LineChart points={chartSection.data} detailed height={320} label={chartQuote.symbol} />
                  ) : (
                    <p className="py-10 text-center text-sm text-fg-3">{t('wide.chartEmpty')}</p>
                  )}
                  {chartSection?.error && chartSection.data.length > 1 && <StaleNote section={chartSection} now={now} />}
                </Card>
              )}
              {reference?.error && <StaleNote section={reference} now={now} />}
            </>
          )}
          <CurrencyEditor
            currencies={m.config.currencies}
            onChange={(currencies) => m.setConfig((c) => ({ ...c, currencies }))}
          />
          <p className="mt-3 text-xs text-fg-3">{t('markets.referenceNote')}</p>
        </section>

        {/* 2. Piyasa fiyatları + altın */}
        <section className="mb-6">
          <SectionHead>{t('markets.liveTitle')}</SectionHead>
          {m.hasKey === false ? (
            <Card>
              <StateView
                compact
                kind="setup"
                title={m.liveDisabled ? t('errors.disabledTitle') : t('markets.setupTitle')}
                description={m.liveDisabled ? t('errors.disabledBody') : t('markets.setupBody')}
                action={
                  <Button icon={KeyRound} variant="primary" onClick={onOpenSettings}>
                    {t('markets.setupAction')}
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <QuoteTable>
                {[...(m.cache.live?.data ?? []), ...(m.cache.gold?.data ?? [])].map((q) => (
                  <QuoteCard key={q.key} quote={q} now={now} />
                ))}
              </QuoteTable>
              {m.cache.live?.error && <SectionError section={m.cache.live} onRetry={() => void m.refresh(true)} inline />}
              {m.cache.gold?.error && <SectionError section={m.cache.gold} onRetry={() => void m.refresh(true)} inline />}
            </>
          )}
        </section>

        {!wide && watchSection}


        {/* 4. DEMO (yalnızca ayarlardan açıkça etkinleştirildiyse) */}
        {settings.showDemoData && (
          <section className="mb-6 rounded-xl border border-demo/40 p-3">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-demo uppercase">{t('markets.demoTitle')}</h3>
            <p className="mb-3 text-xs text-demo">{t('markets.demoBody')}</p>
            <QuoteTable>
              {demoQuotes().map(({ quote, series }) => (
                <QuoteCard key={quote.key} quote={quote} now={now} series={series} />
              ))}
            </QuoteTable>
          </section>
        )}

        <p className="text-xs text-fg-3">{t('markets.sources')}</p>
      </div>
      {wide && <div className="min-h-0 w-[560px] max-w-[45%] shrink-0 overflow-y-auto pr-1">{watchSection}</div>}
      </div>
    </div>
  );
}

function SectionHead({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-md font-semibold">{children}</h3>;
}

function QuoteTable({ children }: { children: ReactNode }) {
  return (
    <Card>
      <div className="flex flex-col p-2">{children}</div>
    </Card>
  );
}

function Change({ quote }: { quote: Quote }) {
  if (quote.change === null && quote.changePct === null) {
    return <span className="text-sm text-fg-3">{t('markets.noChange')}</span>;
  }
  const v = quote.changePct ?? quote.change ?? 0;
  return (
    <span className={cx('tabular inline-flex items-center gap-1 text-sm font-semibold', v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-fg-3')}>
      {quote.change !== null && <span>{formatNumber(quote.change, 4)}</span>}
      {quote.changePct !== null && <span>({formatPercent(quote.changePct)})</span>}
    </span>
  );
}

function QuoteCard({
  quote,
  now,
  series,
  selected,
  onSelect,
}: {
  quote: Quote;
  now: number;
  series?: PricePoint[];
  selected?: boolean;
  onSelect?: () => void;
}) {
  const badge = KIND_BADGE[quote.kind];
  const digits = quote.price >= 1000 ? 2 : 4;
  return (
    <article
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-label={onSelect ? t('wide.selectQuote', { symbol: quote.symbol }) : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={cx(
        'grid grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)_72px] items-center gap-x-4 rounded-lg px-4 py-2.5 transition-colors duration-150',
        selected ? 'bg-accent-soft' : onSelect && 'hover:bg-card-hover',
        quote.kind === 'demo' && 'border border-demo/40',
        onSelect && 'cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-semibold" title={quote.label}>
            {quote.symbol}
          </span>
          <Badge tone={badge.tone} title={quote.note}>
            {t(badge.key)}
          </Badge>
        </div>
        <p className="truncate text-xs text-fg-3" title={`${quote.sourceName}${quote.note ? ` · ${quote.note}` : ''}`}>
          {quote.sourceName}
          {quote.asOf ? ` · ${formatDateTime(quote.asOf)}` : ''}
          {quote.kind !== 'demo' && ` · ${t('markets.fetched', { time: formatRelative(quote.fetchedAt, now) })}`}
        </p>
      </div>
      <div className="text-right">
        <span className="selectable tabular text-base font-semibold">{formatNumber(quote.price, digits)}</span>{' '}
        <span className="text-xs text-fg-3">{quote.currency}</span>
      </div>
      <div className="text-right">
        <Change quote={quote} />
      </div>
      <div>{series && series.length > 1 ? <LineChart points={series} label={quote.symbol} height={28} /> : null}</div>
    </article>
  );
}

function SectionError({ section, onRetry, inline }: { section: Section<unknown>; onRetry: () => void; inline?: boolean }) {
  const text = errorText(section.error);
  if (section.error === 'DISABLED') {
    return inline ? (
      <p className="mt-2 text-sm text-fg-2">{text}</p>
    ) : (
      <StateView compact kind="setup" title={t('errors.disabledTitle')} description={text} />
    );
  }
  if (inline) {
    return (
      <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-down">
        {text}
        <button type="button" className="underline" onClick={onRetry}>
          {t('common.retry')}
        </button>
      </p>
    );
  }
  return (
    <StateView
      compact
      kind={section.error === 'OFFLINE' || section.error === 'TIMEOUT' ? 'offline' : 'error'}
      title={t('markets.sectionError')}
      description={text}
      action={<Button icon={RefreshCw} onClick={onRetry}>{t('common.retry')}</Button>}
    />
  );
}

function errorText(code: string | null): string {
  switch (code) {
    case 'OFFLINE':
      return t('errors.offlineBody');
    case 'TIMEOUT':
      return t('errors.timeoutBody');
    case 'RATE_LIMIT':
      return t('errors.rateBody');
    case 'API_KEY_MISSING':
      return t('errors.keyBody');
    case 'DISABLED':
      return t('errors.disabledBody');
    case 'PARSE':
      return t('markets.parseError');
    default:
      return code ?? '';
  }
}

function StaleNote({ section, now }: { section: Section<unknown>; now: number }) {
  return (
    <p className="mt-2 text-xs text-warn">
      {t('markets.staleNote', { time: formatRelative(section.fetchedAt, now), reason: errorText(section.error) })}
    </p>
  );
}

function CurrencyEditor({ currencies, onChange }: { currencies: string[]; onChange: (list: string[]) => void }) {
  const [available, setAvailable] = useState<string[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState('');

  useEffect(() => {
    if (!adding || available) return;
    let alive = true;
    tcmbProvider
      .listCurrencies()
      .then((list) => alive && setAvailable(list))
      .catch(() => alive && setAvailable([]));
    return () => {
      alive = false;
    };
  }, [adding, available]);

  const options = (available ?? []).filter((c) => !currencies.includes(c));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {currencies.map((c) => (
        <span key={c} className="inline-flex items-center gap-1 rounded-lg bg-control py-1 pr-1.5 pl-2.5 text-sm">
          {c}/TRY
          <button
            type="button"
            aria-label={t('markets.removeCurrency', { code: c })}
            disabled={currencies.length <= 1}
            onClick={() => onChange(currencies.filter((x) => x !== c))}
            className="text-fg-3 hover:text-down disabled:opacity-30"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {adding ? (
        <span className="inline-flex items-center gap-1">
          <Select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label={t('markets.addCurrency')} className="h-8">
            <option value="">{available === null ? t('markets.loading') : t('markets.chooseCurrency')}</option>
            {options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <IconButton
            size="sm"
            icon={Plus}
            label={t('common.add')}
            disabled={!choice}
            onClick={() => {
              onChange([...currencies, choice]);
              setChoice('');
              setAdding(false);
            }}
          />
          <IconButton size="sm" icon={X} label={t('common.cancel')} onClick={() => setAdding(false)} />
        </span>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm text-accent hover:bg-accent-soft">
          <Plus size={12} /> {t('markets.addCurrency')}
        </button>
      )}
    </div>
  );
}

const WIDE_MIN = 1100;

interface WatchlistProps {
  wide: boolean;
  hasKey: boolean;
  items: WatchItem[];
  sections: Record<string, Section<Quote | null>>;
  now: number;
  onAdd: (item: WatchItem) => void;
  onRemove: (key: string) => void;
}

function Watchlist({ hasKey, items, sections, now, wide, onAdd, onRemove }: WatchlistProps) {
  const toast = useToast();
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const add = async () => {
    const item: WatchItem = {
      symbol: symbol.trim().toUpperCase(),
      exchange: exchange.trim().toUpperCase() || undefined,
      providerId: 'twelvedata',
    };
    if (!item.symbol) return;
    if (items.some((w) => watchKey(w) === watchKey(item))) {
      setError(t('markets.watchDuplicate'));
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const result = await twelveDataProvider.validateSymbol(item);
      if (!result.ok) {
        setError(t('markets.watchInvalid', { message: result.message ?? '' }));
        return;
      }
      onAdd({ ...item, name: result.name, exchange: item.exchange ?? result.exchange });
      toast.push('success', t('markets.watchAdded', { symbol: item.symbol }));
      setSymbol('');
      setExchange('');
    } catch (err) {
      setError(describeError(err).description);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      <form
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <TextInput
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder={t('markets.symbolPlaceholder')}
          aria-label={t('markets.symbolPlaceholder')}
          disabled={!hasKey}
          className="w-36"
        />
        <TextInput
          value={exchange}
          onChange={(e) => setExchange(e.target.value)}
          placeholder={t('markets.exchangePlaceholder')}
          aria-label={t('markets.exchangePlaceholder')}
          disabled={!hasKey}
          className="w-36"
        />
        <Button type="submit" icon={checking ? Loader2 : Plus} disabled={!hasKey || checking || !symbol.trim()}>
          {checking ? t('markets.validating') : t('common.add')}
        </Button>
      </form>
      {error && <p role="alert" className="mb-2 text-sm text-down">{error}</p>}
      <p className="mb-3 text-xs text-fg-3">{hasKey ? t('markets.watchHint') : t('markets.watchNeedsKey')}</p>

      {items.length === 0 ? (
        <p className="rounded-xl border border-stroke bg-card px-4 py-5 text-center text-sm text-fg-2">{t('markets.watchEmpty')}</p>
      ) : wide ? (
        <div className="overflow-x-auto rounded-xl border border-stroke bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-fg-3">
                <th className="px-3 py-2 font-medium">{t('wide.colSymbol')}</th>
                <th className="px-3 py-2 font-medium">{t('wide.colName')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('wide.colPrice')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('wide.colChange')}</th>
                <th className="px-3 py-2 font-medium">{t('wide.colKind')}</th>
                <th className="px-3 py-2 font-medium">{t('wide.colTime')}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stroke">
              {items.map((item) => {
                const key = watchKey(item);
                const section = sections[key];
                const quote = section?.data ?? null;
                const badge = quote ? KIND_BADGE[quote.kind] : null;
                return (
                  <Fragment key={key}>
                  <tr
                    className="cursor-pointer hover:bg-card-hover"
                    aria-expanded={selected === key}
                    onClick={() => setSelected((s) => (s === key ? null : key))}
                  >
                    <td className="px-3 py-2.5 font-semibold">
                      {item.symbol}
                      {item.exchange && <span className="ml-1 text-xs font-normal text-fg-3">{item.exchange}</span>}
                    </td>
                    <td className="max-w-40 truncate px-3 py-2.5 text-fg-2" title={item.name}>
                      {item.name ?? ''}
                    </td>
                    {quote ? (
                      <>
                        <td className="tabular px-3 py-2.5 text-right font-semibold">
                          {formatNumber(quote.price, quote.price >= 1000 ? 2 : 4)}{' '}
                          <span className="text-xs font-normal text-fg-3">{quote.currency}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Change quote={quote} />
                        </td>
                        <td className="px-3 py-2.5">
                          {badge && (
                            <Badge tone={badge.tone} title={quote.note}>
                              {t(badge.key)}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap text-fg-3" title={quote.sourceName}>
                          {quote.asOf ? formatDateTime(quote.asOf) : formatRelative(quote.fetchedAt, now)}
                          {section?.error ? `  · ${t('markets.lastGood', { time: formatRelative(section.fetchedAt, now) })}` : ''}
                        </td>
                      </>
                    ) : (
                      <td colSpan={4} className="px-3 py-2.5 text-sm">
                        {section?.error ? (
                          <span className="text-down">{errorText(section.error)}</span>
                        ) : (
                          <span className="text-fg-3">{hasKey ? '…' : '—'}</span>
                        )}
                      </td>
                    )}
                    <td className="px-1" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="sm" tone="danger" icon={Trash2} label={t('common.remove')} onClick={() => onRemove(key)} />
                    </td>
                  </tr>
                  {selected === key && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <WatchDetail item={item} quote={quote} stale={section?.error ? section.fetchedAt : null} now={now} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="divide-y divide-stroke overflow-hidden rounded-xl border border-stroke bg-card">
          {items.map((item) => {
            const key = watchKey(item);
            const section = sections[key];
            const quote = section?.data ?? null;
            return (
              <li key={key}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelected((s) => (s === key ? null : key))}
                    aria-expanded={selected === key}
                  >
                    <p className="truncate text-base font-semibold">
                      {item.symbol}
                      {item.exchange && <span className="ml-1 text-xs font-normal text-fg-3">{item.exchange}</span>}
                    </p>
                    <p className="truncate text-xs text-fg-3">{item.name ?? ''}</p>
                  </button>
                  {quote ? (
                    <div className="text-right">
                      <p className="tabular text-base font-semibold">
                        {formatNumber(quote.price, quote.price >= 1000 ? 2 : 4)} <span className="text-xs font-normal text-fg-3">{quote.currency}</span>
                      </p>
                      <Change quote={quote} />
                    </div>
                  ) : section?.error ? (
                    <span className="max-w-40 truncate text-sm text-down" title={errorText(section.error)}>
                      {errorText(section.error)}
                    </span>
                  ) : (
                    <span className="text-sm text-fg-3">{hasKey ? '…' : '—'}</span>
                  )}
                  <IconButton size="sm" tone="danger" icon={Trash2} label={t('common.remove')} onClick={() => onRemove(key)} />
                </div>
                {selected === key && (
                  <WatchDetail item={item} quote={quote} stale={section?.error ? section.fetchedAt : null} now={now} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Seriler kredi harcar: yalnızca açılan satır için ve oturum başına bir kez çekilir.
const seriesCache = new Map<string, PricePoint[]>();

function WatchDetail({ item, quote, stale, now }: { item: WatchItem; quote: Quote | null; stale: number | null; now: number }) {
  const key = watchKey(item);
  const [series, setSeries] = useState<PricePoint[] | null>(() => seriesCache.get(key) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seriesCache.has(key)) return;
    let alive = true;
    twelveDataProvider
      .getDailySeries(item, 30)
      .then((s) => {
        seriesCache.set(key, s);
        if (alive) setSeries(s);
      })
      .catch((err: unknown) => alive && setError(describeError(err).description));
    return () => {
      alive = false;
    };
  }, [item, key]);

  let body: ReactNode;
  if (error) body = <p className="text-sm text-down">{error}</p>;
  else if (!series) body = <p className="text-sm text-fg-3">{t('markets.loading')}</p>;
  else body = <LineChart points={series} detailed height={110} label={item.symbol} digits={quote && quote.price >= 1000 ? 2 : 4} />;

  return (
    <div className="bg-layer px-4 py-3">
      <p className="mb-1 text-xs text-fg-3">{t('markets.dailySeries')}</p>
      {body}
      {quote && (
        <p className="mt-1.5 text-xs text-fg-3">
          {quote.sourceName}
          {quote.asOf ? ` · ${formatDateTime(quote.asOf)}` : ''}
          {quote.note ? ` · ${quote.note}` : ''}
          {stale ? ` · ${t('markets.lastGood', { time: formatRelative(stale, now) })}` : ''}
        </p>
      )}
    </div>
  );
}

