import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Fragment } from 'react';
import { t } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { formatDateTime, formatRelative } from '../../shared/lib/time';
import { Badge, cx } from '../../shared/ui/primitives';
import { KIND_BADGE } from '../markets/kindBadge';
import type { Quote } from '../markets/types';
import type { NewsItem } from '../news/types';
import type { PanelId } from '../window-manager/panels';
import { changeTone, formatChange, formatQuotePrice, type ChangeTone } from './ticker';
import { useTicker } from './useTicker';

const KIND_SHORT = {
  reference: 'ticker.kind.reference',
  market: 'ticker.kind.market',
  derived: 'ticker.kind.derived',
  demo: 'ticker.kind.demo',
} as const;

const TONE_CLASS: Record<ChangeTone, string> = { up: 'text-up', down: 'text-down', flat: 'text-muted', none: 'text-faint' };
const TONE_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus, none: Minus } as const;

const FADE = 'linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)';

/** Alt şerit: solda fiyat çipleri, sağda kayan haber başlıkları. */
export function TickerBar({ onOpenPanel }: { onOpenPanel: (p: PanelId) => void }) {
  const ticker = useTicker();
  const now = useNow();
  const { quotes, headlines, current, animate, durationSec, openHeadline, newsLoaded } = ticker;

  return (
    <div className="flex h-full min-w-0 items-center gap-3">
      {quotes.length > 0 && (
        <div className="flex max-w-[50%] shrink-0 items-center gap-2 overflow-hidden">
          {quotes.map((q) => (
            <QuoteChip key={q.key} quote={q} now={now} onClick={() => onOpenPanel('markets')} />
          ))}
        </div>
      )}

      <div className="min-w-0 flex-1 overflow-hidden" style={{ maskImage: FADE, WebkitMaskImage: FADE }}>
        {headlines.length === 0 ? (
          newsLoaded && <p className="truncate px-3 text-sm text-faint">{t('ticker.noNews')}</p>
        ) : animate ? (
          <>
            <style>{`@keyframes alpicim-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
            <div
              className="flex w-max items-center hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
              style={{ animation: `alpicim-marquee ${durationSec}s linear infinite` }}
            >
              <HeadlineGroup items={headlines} onOpen={openHeadline} />
              <HeadlineGroup items={headlines} onOpen={openHeadline} hidden />
            </div>
          </>
        ) : (
          current && (
            <div key={current.id} className="flex items-center">
              <HeadlineButton item={current} onOpen={openHeadline} />
            </div>
          )
        )}
      </div>

      <button
        type="button"
        className="h-9 shrink-0 rounded-xl px-3 text-sm text-muted transition-colors hover:bg-surface-3 hover:text-fg"
        onClick={() => onOpenPanel('news')}
      >
        {t('ticker.all')}
      </button>
    </div>
  );
}

function QuoteChip({ quote, now, onClick }: { quote: Quote; now: number; onClick: () => void }) {
  const tone = changeTone(quote);
  const Icon = TONE_ICON[tone];
  const change = formatChange(quote);
  const badge = KIND_BADGE[quote.kind];
  const time = quote.asOf ? formatDateTime(quote.asOf) : t('markets.fetched', { time: formatRelative(quote.fetchedAt, now) });
  return (
    <button
      type="button"
      title={`${quote.label} · ${quote.sourceName} · ${time}`}
      aria-label={t('bar.quoteLabel', { symbol: quote.symbol, price: formatQuotePrice(quote) })}
      onClick={onClick}
      className={cx(
        'flex h-9 shrink-0 items-center gap-2 rounded-xl bg-surface-2 px-2.5 text-sm transition-colors hover:bg-surface-3',
        quote.kind === 'demo' && 'shadow-[inset_0_0_0_1px_var(--demo)]',
      )}
    >
      <span className="font-medium text-fg">{quote.symbol}</span>
      <span className="tabular text-fg">{formatQuotePrice(quote)}</span>
      {change && (
        <span className={cx('tabular inline-flex items-center', TONE_CLASS[tone])}>
          <Icon size={14} aria-hidden />
          {change}
        </span>
      )}
      <Badge tone={badge.tone} title={t(badge.key)}>
        {t(KIND_SHORT[quote.kind])}
      </Badge>
    </button>
  );
}

function HeadlineGroup({ items, onOpen, hidden }: { items: readonly NewsItem[]; onOpen: (i: NewsItem) => void; hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <Fragment key={item.id}>
          <HeadlineButton item={item} onOpen={onOpen} tabIndex={hidden ? -1 : undefined} />
          <span className="text-faint" aria-hidden>
            •
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function HeadlineButton({ item, onOpen, tabIndex }: { item: NewsItem; onOpen: (i: NewsItem) => void; tabIndex?: number }) {
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      title={`${item.title} (${item.source})`}
      aria-label={t('bar.headlineLabel', { title: item.title, source: item.source })}
      onClick={() => void onOpen(item)}
      className="shrink-0 rounded-lg whitespace-nowrap px-3 text-sm text-fg transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
    >
      {item.title}
      <span className="text-faint"> · {item.source}</span>
    </button>
  );
}
