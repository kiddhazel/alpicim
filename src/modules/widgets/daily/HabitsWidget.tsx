import { Check, Flame, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../i18n';
import { useNow } from '../../../shared/lib/hooks';
import { cx, IconButton, TextInput } from '../../../shared/ui/primitives';
import { toDateKey } from '../basic/calendar';
import type { WidgetProps, WidgetSettingsProps } from '../types';
import { addHabit, bestStreak, currentStreak, isDone, lastDays, MAX_HABITS, removeHabit, toggleDay, type HabitsConfig } from './habits';

export { habitsDefaults, sanitizeHabits } from './habits';

const DAY_FMT = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
const WEEKDAY_FMT = new Intl.DateTimeFormat('tr-TR', { weekday: 'narrow' });

function dayDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Alışkanlıklar: bugün yapıldı mı, güncel seri ve son 7 gün. */
export function HabitsWidget({ config, setConfig, size }: WidgetProps<HabitsConfig>) {
  const now = useNow(60_000);
  const today = toDateKey(new Date(now));
  const week = lastDays(today, 7);
  const habits = config.habits;
  const showWeek = size.w >= 4;
  const doneToday = habits.filter((h) => isDone(h, today)).length;
  const set = (next: HabitsConfig['habits']) => setConfig({ habits: next });

  return (
    <div className="flex h-full flex-col">
      {habits.length > 0 && showWeek && (
        <div className="flex items-center gap-2.5 px-4 pb-1 text-xs text-faint">
          <span className="min-w-0 flex-1">{t('widgets.habits.summary', { done: doneToday, total: habits.length })}</span>
          <span className="flex gap-1" aria-hidden>
            {week.map((d) => (
              <span key={d} className={cx('w-4 text-center', d === today && 'font-semibold text-accent')}>
                {WEEKDAY_FMT.format(dayDate(d))}
              </span>
            ))}
          </span>
          <span className="w-8" />
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto px-2">
        {habits.length === 0 && <li className="px-2 py-3 text-center text-sm text-faint">{t('widgets.habits.empty')}</li>}
        {habits.map((h) => {
          const done = isDone(h, today);
          const streak = currentStreak(h.days, today);
          return (
            <li key={h.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-surface-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={h.name}>
                  {h.name}
                </p>
                <p className="flex items-center gap-1 text-xs text-faint" title={t('widgets.habits.best', { n: bestStreak(h.days) })}>
                  <Flame size={12} className={streak > 0 ? 'text-warn' : undefined} />
                  {t('widgets.habits.streak', { n: streak })}
                </p>
              </div>
              {showWeek && (
                <div className="flex gap-1">
                  {week.map((d) => {
                    const on = isDone(h, d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        title={t('widgets.habits.dayToggle', {
                          date: DAY_FMT.format(dayDate(d)),
                          state: on ? t('widgets.habits.doneState') : t('widgets.habits.notDone'),
                        })}
                        aria-label={`${h.name}: ${DAY_FMT.format(dayDate(d))}`}
                        onClick={() => set(toggleDay(habits, h.id, d, today))}
                        className={cx(
                          'h-4 w-4 rounded-full transition-colors',
                          on ? 'bg-accent-gradient' : 'bg-surface-3 hover:bg-accent-soft',
                          d === today && 'ring-1 ring-accent ring-offset-1 ring-offset-transparent',
                        )}
                      />
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                aria-pressed={done}
                title={done ? t('widgets.habits.undo') : t('widgets.habits.markDone')}
                aria-label={`${h.name}: ${done ? t('widgets.habits.undo') : t('widgets.habits.markDone')}`}
                onClick={() => set(toggleDay(habits, h.id, today, today))}
                className={cx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all',
                  done
                    ? 'bg-accent-gradient text-white shadow-[0_0_16px_-4px_var(--accent)]'
                    : 'text-faint shadow-[inset_0_0_0_1.5px_var(--glass-edge)] hover:bg-accent-soft hover:text-accent',
                )}
              >
                <Check size={16} strokeWidth={2.5} />
              </button>
            </li>
          );
        })}
      </ul>
      {(habits.length === 0 || size.h >= 3) && <AddHabitForm habits={habits} onChange={set} className="px-4 pt-1 pb-3" />}
    </div>
  );
}

function AddHabitForm({
  habits,
  onChange,
  className,
}: {
  habits: HabitsConfig['habits'];
  onChange: (h: HabitsConfig['habits']) => void;
  className?: string;
}) {
  const [name, setName] = useState('');
  return (
    <form
      className={cx('flex gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault();
        onChange(addHabit(habits, name));
        setName('');
      }}
    >
      <TextInput value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t('widgets.habits.placeholder')} className="min-w-0 flex-1 text-sm" />
      <IconButton icon={Plus} label={t('common.add')} type="submit" disabled={!name.trim() || habits.length >= MAX_HABITS} />
    </form>
  );
}

export function HabitsSettings({ config, setConfig }: WidgetSettingsProps<HabitsConfig>) {
  const set = (next: HabitsConfig['habits']) => setConfig({ habits: next });
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {config.habits.map((h) => (
          <li key={h.id} className="flex items-center gap-1.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{h.name}</span>
            <IconButton size="sm" icon={X} tone="danger" label={t('widgets.habits.remove', { name: h.name })} onClick={() => set(removeHabit(config.habits, h.id))} />
          </li>
        ))}
      </ul>
      <AddHabitForm habits={config.habits} onChange={set} />
    </div>
  );
}
