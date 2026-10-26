import { Check, Flame, Plus, X } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { t } from '../../../i18n';
import { useNow } from '../../../shared/lib/hooks';
import { cx, IconButton, Select, TextInput } from '../../../shared/ui/primitives';
import { celebrate } from '../../fx/confetti';
import { toDateKey } from '../basic/calendar';
import type { WidgetProps, WidgetSettingsProps } from '../types';
import {
  addHabit,
  DAILY_GOAL,
  habitStats,
  isDone,
  lastDays,
  MAX_HABITS,
  removeHabit,
  setGoal,
  toggleDay,
  toggleWithMilestone,
  type HabitsConfig,
} from './habits';

export { habitsDefaults, sanitizeHabits } from './habits';

const DAY_FMT = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
const WEEKDAY_FMT = new Intl.DateTimeFormat('tr-TR', { weekday: 'narrow' });
/** Hedef seçeneklerinin sırası: her gün (7), sonra haftada 1–6 gün. */
const GOAL_OPTIONS = [7, 1, 2, 3, 4, 5, 6] as const;

function dayDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function goalText(goal: number): string {
  return goal >= DAILY_GOAL ? t('widgets.habits.goalDaily') : t('widgets.habits.goalWeekly', { n: goal });
}

/** Alışkanlıklar: hedef, güncel/en uzun seri, bu hafta ve son 30 gün. */
export function HabitsWidget({ config, setConfig, size }: WidgetProps<HabitsConfig>) {
  const now = useNow(60_000);
  const today = toDateKey(new Date(now));
  const week = lastDays(today, 7);
  const month = lastDays(today, 30);
  const habits = config.habits;
  const showWeek = size.w >= 4;
  const showMonth = size.w >= 6;
  const doneToday = habits.filter((h) => isDone(h, today)).length;
  const set = (next: HabitsConfig['habits']) => setConfig({ habits: next });

  const mark = (e: MouseEvent<HTMLButtonElement>, id: string, day: string) => {
    const { habits: next, milestone } = toggleWithMilestone(habits, id, day, today);
    set(next);
    if (milestone !== null) celebrate({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex h-full flex-col">
      {habits.length > 0 && showWeek && (
        <div className="flex items-center gap-2.5 px-4 pb-1 text-xs text-fg-3">
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
        {habits.length === 0 && <li className="px-2 py-3 text-center text-sm text-fg-3">{t('widgets.habits.empty')}</li>}
        {habits.map((h) => {
          const done = isDone(h, today);
          const stats = habitStats(h, today);
          const streakText =
            stats.unit === 'day' ? t('widgets.habits.streakDay', { n: stats.streak }) : t('widgets.habits.streakWeek', { n: stats.streak });
          const bestText = t('widgets.habits.bestLine', { n: stats.best });
          return (
            <li key={h.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-control-hover">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" title={`${h.name} · ${goalText(h.goal)}`}>
                  {h.name}
                </p>
                <p className="flex min-w-0 items-center gap-1 text-xs text-fg-3" title={goalText(h.goal)}>
                  <Flame size={12} className={stats.streak > 0 ? 'shrink-0 text-warn' : 'shrink-0'} />
                  <span className="truncate">
                    {streakText} · {bestText}
                    {h.goal < DAILY_GOAL && ` · ${t('widgets.habits.weekProgress', { done: stats.weekDone, goal: h.goal })}`}
                  </span>
                </p>
                {showMonth && (
                  <div className="mt-1 flex gap-[3px]" role="img" aria-label={`${h.name}: ${t('widgets.habits.last30')}`}>
                    {month.map((d) => (
                      <span
                        key={d}
                        title={DAY_FMT.format(dayDate(d))}
                        className={cx('h-1.5 w-1.5 rounded-full', isDone(h, d) ? 'bg-accent' : 'bg-control', d === today && 'ring-1 ring-accent')}
                      />
                    ))}
                  </div>
                )}
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
                        onClick={(e) => (on ? set(toggleDay(habits, h.id, d, today)) : mark(e, h.id, d))}
                        className={cx(
                          'h-4 w-4 rounded-full transition-colors',
                          on ? 'bg-accent text-on-accent' : 'bg-control hover:bg-accent-soft',
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
                onClick={(e) => (done ? set(toggleDay(habits, h.id, today, today)) : mark(e, h.id, today))}
                className={cx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all',
                  done
                    ? 'bg-accent text-on-accent'
                    : 'text-fg-3 shadow-[inset_0_0_0_1.5px_var(--stroke)] hover:bg-accent-soft hover:text-accent',
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

function GoalSelect({ value, onChange, label }: { value: number; onChange: (goal: number) => void; label: string }) {
  return (
    <Select aria-label={label} title={label} value={value} onChange={(e) => onChange(Number(e.target.value))} className="shrink-0 text-sm">
      {GOAL_OPTIONS.map((g) => (
        <option key={g} value={g}>
          {goalText(g)}
        </option>
      ))}
    </Select>
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
  const [goal, setGoalValue] = useState<number>(DAILY_GOAL);
  return (
    <form
      className={cx('flex gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault();
        onChange(addHabit(habits, name, goal));
        setName('');
      }}
    >
      <TextInput value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t('widgets.habits.placeholder')} className="min-w-0 flex-1 text-sm" />
      <GoalSelect value={goal} onChange={setGoalValue} label={t('widgets.habits.goalLabel')} />
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
            <GoalSelect value={h.goal} onChange={(goal) => set(setGoal(config.habits, h.id, goal))} label={t('widgets.habits.goalOf', { name: h.name })} />
            <IconButton size="sm" icon={X} tone="danger" label={t('widgets.habits.remove', { name: h.name })} onClick={() => set(removeHabit(config.habits, h.id))} />
          </li>
        ))}
      </ul>
      <AddHabitForm habits={config.habits} onChange={set} />
    </div>
  );
}
