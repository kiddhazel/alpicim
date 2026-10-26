import { Angry, ChevronLeft, ChevronRight, Frown, Laugh, Meh, Annoyed, Smile, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t, type MessageKey } from '../../../i18n';
import { track } from '../../../shared/lib/track';
import { usePersistentState } from '../../../shared/lib/usePersistentState';
import { cx, IconButton } from '../../../shared/ui/primitives';
import { toDateKey } from '../basic/calendar';
import type { WidgetProps } from '../types';
import {
  moodTint,
  MOOD_IDS,
  MOOD_KEY,
  MOOD_NOTE_MAX,
  monthCount,
  monthGrid,
  sanitizeMoodLog,
  setMood,
  setNote,
  type MoodId,
  type MoodLog,
} from './mood';

export type MoodConfig = Record<string, never>;

const ICONS: Record<MoodId, LucideIcon> = { great: Laugh, good: Smile, ok: Meh, tired: Annoyed, sad: Frown, angry: Angry };
const moodLabel = (m: MoodId) => t(`widgets.mood.moods.${m}` as MessageKey);

/** Ruh hâli günlüğü: günde bir yüz + kısa not; ay takvimi ısı haritası. */
export function MoodWidget({ size }: WidgetProps<MoodConfig>) {
  const [log, setLog] = usePersistentState<MoodLog>(MOOD_KEY, {}, sanitizeMoodLog);
  const today = toDateKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const entry = log[today];
  const [note, setNoteText] = useState('');
  useEffect(() => setNoteText(entry?.note ?? ''), [entry?.note, today]);

  const pick = (mood: MoodId) => {
    const r = setMood(log, today, mood);
    setLog(r.log);
    if (r.isNew) track('mood.logged');
  };
  const saveNote = () => {
    if (entry && note !== entry.note) setLog(setNote(log, today, note));
  };

  const weeks = monthGrid(cursor.y, cursor.m, log);
  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const shift = (d: number) => setCursor((c) => {
    const n = new Date(c.y, c.m + d, 1);
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const compact = size.h < 4;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-4 pb-3">
      <p className="text-xs text-fg-3">{entry ? t('widgets.mood.today', { mood: moodLabel(entry.mood) }) : t('widgets.mood.ask')}</p>
      <div className="flex gap-1.5" role="group" aria-label={t('widgets.mood.title')}>
        {MOOD_IDS.map((m) => {
          const Icon = ICONS[m];
          const on = entry?.mood === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              aria-label={moodLabel(m)}
              title={moodLabel(m)}
              onClick={() => pick(m)}
              className={cx('flex flex-1 items-center justify-center rounded-lg py-1.5 transition hover:bg-control-hover', on && 'bg-control ring-1 ring-[var(--accent)]')}
            >
              <Icon size={compact ? 20 : 24} className={on ? 'text-accent' : 'text-fg-2'} aria-hidden />
            </button>
          );
        })}
      </div>
      {entry && (
        <input
          value={note}
          maxLength={MOOD_NOTE_MAX}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={saveNote}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder={t('widgets.mood.notePlaceholder')}
          aria-label={t('widgets.mood.notePlaceholder')}
          className="selectable w-full rounded-lg bg-control px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      )}
      {!compact && (
        <div className="min-h-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <IconButton size="sm" icon={ChevronLeft} label={t('widgets.mood.prev')} onClick={() => shift(-1)} />
            <span className="text-xs font-semibold capitalize">
              {monthName} <span className="text-fg-3">· {monthCount(cursor.y, cursor.m, log)}</span>
            </span>
            <IconButton size="sm" icon={ChevronRight} label={t('widgets.mood.next')} onClick={() => shift(1)} />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weeks.flat().map((c, i) =>
              c === null ? (
                <span key={`e${i}`} />
              ) : (
                <span
                  key={c.key}
                  title={c.mood ? `${c.key}: ${moodLabel(c.mood)}${log[c.key]?.note ? ` — ${log[c.key]?.note}` : ''}` : c.key}
                  className={cx('flex aspect-square items-center justify-center rounded text-xs', c.mood ? 'font-semibold text-fg' : 'bg-control text-fg-3', c.key === today && 'ring-1 ring-[var(--accent)]')}
                  style={c.mood ? { backgroundColor: moodTint(c.mood) } : undefined}
                >
                  {c.day}
                </span>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
