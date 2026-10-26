import { Hourglass, Plus, Repeat as RepeatIcon, X } from 'lucide-react';
import { useState } from 'react';
import { t, type MessageKey } from '../../../i18n';
import { useNow } from '../../../shared/lib/hooks';
import { cx, IconButton, Select, TextInput } from '../../../shared/ui/primitives';
import { parseDateKey, toDateKey } from '../basic/calendar';
import type { WidgetProps, WidgetSettingsProps } from '../types';
import { addCountdown, MAX_COUNTDOWNS, occurrences, REPEATS, type CountdownConfig, type Occurrence, type Repeat } from './countdown';

export { countdownDefaults, sanitizeCountdown } from './countdown';

const DATE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
const DATE_SHORT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

const REPEAT_KEY: Record<Repeat, MessageKey> = {
  none: 'widgets.countdown.repeatNone',
  monthly: 'widgets.countdown.repeatMonthly',
  yearly: 'widgets.countdown.repeatYearly',
};

function label(o: Occurrence): string {
  if (o.days < 0) return t('widgets.countdown.passed');
  if (o.days === 0) return t('widgets.countdown.today');
  if (o.days === 1) return t('widgets.countdown.tomorrow');
  return t('widgets.countdown.days', { n: o.days });
}

function fmt(key: string, f: Intl.DateTimeFormat): string {
  const d = parseDateKey(key);
  return d ? f.format(d) : key;
}

/** Geri sayım: en yakın tarih büyük, diğerleri liste hâlinde. */
export function CountdownWidget({ config, size }: WidgetProps<CountdownConfig>) {
  const now = useNow(60_000);
  const today = toDateKey(new Date(now));
  const list = occurrences(config.events, today);

  if (list.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
        <Hourglass size={20} className="text-fg-3" />
        <p className="text-sm text-fg-2">{t('widgets.countdown.empty')}</p>
        <p className="text-xs text-fg-3">{t('widgets.countdown.emptyBody')}</p>
      </div>
    );
  }

  const [first, ...rest] = list as [Occurrence, ...Occurrence[]];
  const soon = first.days >= 0 && first.days <= 1;
  return (
    <div className="flex h-full flex-col gap-2 px-4 pb-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold" title={first.event.title}>
            {first.event.title}
          </p>
          <p className="truncate text-xs text-fg-3">
            {fmt(first.date, DATE_FMT)}
            {first.event.repeat !== 'none' && ` · ${t(REPEAT_KEY[first.event.repeat])}`}
          </p>
        </div>
        <p className={cx('shrink-0 font-display font-semibold tabular-nums', first.days > 1 ? 'text-4xl' : 'text-2xl', soon ? 'text-fg' : first.days < 0 ? 'text-fg-3' : 'text-fg')}>
          {first.days > 1 ? first.days : label(first)}
          {first.days > 1 && <span className="ml-1 text-sm font-normal text-fg-2">{t('widgets.countdown.dayUnit')}</span>}
        </p>
      </div>
      {size.h >= 3 && rest.length > 0 && (
        <ul className="min-h-0 flex-1 divide-y divide-stroke overflow-y-auto">
          {rest.map((o) => (
            <li key={o.event.id} className="flex items-center gap-2 py-1.5 text-sm">
              {o.event.repeat !== 'none' && <RepeatIcon size={12} className="shrink-0 text-fg-3" aria-label={t(REPEAT_KEY[o.event.repeat])} />}
              <span className={cx('min-w-0 flex-1 truncate', o.days < 0 && 'text-fg-3')} title={fmt(o.date, DATE_SHORT)}>
                {o.event.title}
              </span>
              <span className={cx('shrink-0 tabular-nums', o.days < 0 ? 'text-fg-3' : o.days <= 7 ? 'font-semibold text-accent' : 'text-fg-2')}>
                {label(o)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CountdownSettings({ config, setConfig }: WidgetSettingsProps<CountdownConfig>) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [invalid, setInvalid] = useState(false);
  const events = config.events;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-1.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{e.title}</span>
            <span className="shrink-0 text-xs text-fg-3">
              {fmt(e.date, DATE_SHORT)} · {t(REPEAT_KEY[e.repeat])}
            </span>
            <IconButton size="sm" icon={X} tone="danger" label={t('common.remove')} onClick={() => setConfig({ events: events.filter((x) => x.id !== e.id) })} />
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const next = addCountdown(events, title, date, repeat);
          if (!next) {
            setInvalid(true);
            return;
          }
          setConfig({ events: next });
          setTitle('');
          setDate('');
          setRepeat('none');
          setInvalid(false);
        }}
      >
        <TextInput value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={t('widgets.countdown.placeholder')} />
        <div className="flex gap-1.5">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('widgets.countdown.date')} className="min-w-0 flex-1" />
          <Select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} aria-label={t('widgets.countdown.repeat')}>
            {REPEATS.map((r) => (
              <option key={r} value={r}>
                {t(REPEAT_KEY[r])}
              </option>
            ))}
          </Select>
          <IconButton icon={Plus} label={t('common.add')} type="submit" disabled={events.length >= MAX_COUNTDOWNS} />
        </div>
        {invalid && <p className="text-xs text-warn">{t('widgets.countdown.invalid')}</p>}
        <p className="text-xs text-fg-3">{t('widgets.countdown.hint')}</p>
      </form>
    </div>
  );
}
