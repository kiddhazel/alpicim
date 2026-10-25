import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { t } from '../../../i18n';
import { cx, IconButton, TextInput } from '../../../shared/ui/primitives';
import type { WidgetProps } from '../types';
import {
  addEvent,
  addMonths,
  datesWithEvents,
  eventsOn,
  monthMatrix,
  parseDateKey,
  removeEvent,
  toDateKey,
  upcoming,
  type CalendarConfig,
  type CalendarEvent,
} from './calendar';

export { calendarDefaults, sanitizeCalendar } from './calendar';

const WEEKDAY_FMT = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });
const MONTH_FMT = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const DAY_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
const SHORT_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

/** 2024-01-01 bir Pazartesi: Pazartesi başlangıçlı kısa gün adları. */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => WEEKDAY_FMT.format(new Date(2024, 0, 1 + i)));

function useToday(): string {
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setToday(toDateKey(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}

function fmt(f: Intl.DateTimeFormat, key: string): string {
  const d = parseDateKey(key);
  return d ? f.format(d) : key;
}

function EventRow({ ev, showDate, onRemove }: { ev: CalendarEvent; showDate?: boolean; onRemove: (id: string) => void }) {
  return (
    <li className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-3">
      <span className="w-[72px] shrink-0 text-xs text-accent tabular-nums">
        {showDate ? fmt(SHORT_FMT, ev.date) : ''}
        {showDate && ev.time ? ' ' : ''}
        {ev.time ?? (showDate ? '' : t('widgets.calendar.allDay'))}
      </span>
      <span className="selectable min-w-0 flex-1 truncate text-sm" title={ev.title}>
        {ev.title}
      </span>
      <button
        type="button"
        aria-label={t('common.remove')}
        onClick={() => onRemove(ev.id)}
        className="rounded p-1 text-faint opacity-0 group-hover:opacity-100 hover:text-down focus:opacity-100"
      >
        <X size={14} />
      </button>
    </li>
  );
}

export function CalendarWidget({ config, setConfig, size }: WidgetProps<CalendarConfig>) {
  const today = useToday();
  const large = size.w >= 4 && size.h >= 4;
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const events = config.events;
  const marked = useMemo(() => datesWithEvents(events), [events]);
  const matrix = useMemo(() => monthMatrix(view.year, view.month), [view.year, view.month]);
  const day = selected ?? today;
  const dayEvents = useMemo(() => eventsOn(events, day), [events, day]);
  const soon = useMemo(() => upcoming(events, today, 7), [events, today]);
  const remove = (id: string) => setConfig({ events: removeEvent(events, id) });

  const addForm = (
    <form
      className="flex gap-1.5 px-1 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        setConfig({ events: addEvent(events, day, time, title) });
        setTitle('');
      }}
    >
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        aria-label={t('widgets.calendar.time')}
        className="h-[30px] w-[88px] shrink-0 rounded-lg bg-surface-2 px-1.5 text-sm text-fg shadow-[inset_0_0_0_1px_var(--glass-edge)] focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <TextInput
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('widgets.calendar.placeholder')}
        className="h-[30px] min-w-0 flex-1 text-sm"
      />
      <IconButton size="sm" icon={Plus} label={t('common.add')} type="submit" disabled={!title.trim() || events.length >= 300} />
    </form>
  );

  if (!large) {
    const list = soon.slice(0, 3);
    return (
      <div className="flex h-full flex-col px-3 pb-2">
        <div className="flex items-baseline justify-between px-1">
          <span className="text-sm font-medium capitalize">{fmt(DAY_FMT, today)}</span>
          <span className="text-xs text-faint">{t('widgets.calendar.todayCount', { n: eventsOn(events, today).length })}</span>
        </div>
        <p className="px-1 pt-1.5 text-xs text-muted">{t('widgets.calendar.upcoming')}</p>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 && <li className="px-1 py-2 text-sm text-faint">{t('widgets.calendar.noUpcoming')}</li>}
          {list.map((ev) => (
            <EventRow key={ev.id} ev={ev} showDate onRemove={remove} />
          ))}
        </ul>
        {addForm}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 px-3 pb-2 sm:flex-row sm:gap-3">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between pb-1">
          <IconButton size="sm" icon={ChevronLeft} label={t('widgets.calendar.prev')} onClick={() => setView((v) => addMonths(v.year, v.month, -1))} />
          <button
            type="button"
            className="text-sm font-medium capitalize hover:text-accent"
            title={t('widgets.calendar.goToday')}
            onClick={() => {
              const d = new Date();
              setView({ year: d.getFullYear(), month: d.getMonth() });
              setSelected(today);
            }}
          >
            {MONTH_FMT.format(new Date(view.year, view.month, 1))}
          </button>
          <IconButton size="sm" icon={ChevronRight} label={t('widgets.calendar.next')} onClick={() => setView((v) => addMonths(v.year, v.month, 1))} />
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-faint">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-0.5 capitalize">
              {w}
            </span>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-0.5">
          {matrix.flat().map((c) => (
            <button
              key={c.date}
              type="button"
              onClick={() => setSelected(c.date)}
              aria-label={fmt(DAY_FMT, c.date)}
              aria-pressed={c.date === day}
              className={cx(
                'relative flex items-center justify-center rounded-lg text-sm tabular-nums transition-colors hover:bg-surface-3',
                !c.inMonth && 'text-faint',
                c.date === today && 'ring-2 ring-accent',
                c.date === day && 'bg-surface-3 font-semibold',
              )}
            >
              {c.day}
              {marked.has(c.date) && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <p className="px-1 pb-1 text-sm font-medium capitalize">{fmt(DAY_FMT, day)}</p>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {dayEvents.length === 0 && <li className="px-1 py-2 text-sm text-faint">{t('widgets.calendar.noEvents')}</li>}
          {dayEvents.map((ev) => (
            <EventRow key={ev.id} ev={ev} onRemove={remove} />
          ))}
          {soon.length > 0 && (
            <>
              <li className="px-1 pt-2 text-xs text-muted">{t('widgets.calendar.upcoming')}</li>
              {soon.slice(0, 5).map((ev) => (
                <EventRow key={`u${ev.id}`} ev={ev} showDate onRemove={remove} />
              ))}
            </>
          )}
        </ul>
        {addForm}
      </div>
    </div>
  );
}
