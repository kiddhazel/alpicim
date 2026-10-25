import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import { t } from '../../../i18n';
import { useNow } from '../../../shared/lib/hooks';
import { Button, cx, TextInput } from '../../../shared/ui/primitives';
import { num, obj, type WidgetProps, type WidgetSettingsProps } from '../types';
import { advance, formatClock, pause, remaining, reset, sanitizeState, start, type PomodoroState } from './pomodoro';

export interface PomodoroConfig {
  workMin: number;
  breakMin: number;
  state: PomodoroState;
}

export const pomodoroDefaults: PomodoroConfig = { workMin: 25, breakMin: 5, state: sanitizeState(null, 25) };

export function sanitizePomodoro(raw: unknown): PomodoroConfig {
  const r = obj(raw);
  const workMin = num(r.workMin, 5, 120, 25);
  return { workMin, breakMin: num(r.breakMin, 1, 60, 5), state: sanitizeState(r.state, workMin) };
}

/** Kısa bir uyarı sesi (Web Audio; dosya veya ağ gerektirmez). */
function chime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
    osc.onended = () => void ctx.close();
  } catch {
    /* ses aygıtı yoksa sessiz geç */
  }
}

export function PomodoroWidget({ config, setConfig, size }: WidgetProps<PomodoroConfig>) {
  const running = config.state.endsAt !== null;
  const now = useNow(running ? 500 : 60_000);
  const left = remaining(config.state, now);

  // Süre dolunca evre değiştir ve uyar.
  useEffect(() => {
    const next = advance(config.state, now, config.workMin, config.breakMin);
    if (next !== config.state) {
      setConfig({ state: next });
      chime();
    }
  }, [now, config.state, config.workMin, config.breakMin, setConfig]);

  const total = (config.state.phase === 'work' ? config.workMin : config.breakMin) * 60_000;
  const progress = total > 0 ? 1 - left / total : 0;
  const big = size.h >= 3;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
      <p className={cx('text-xs font-semibold uppercase tracking-wider', config.state.phase === 'work' ? 'text-accent' : 'text-up')}>
        {config.state.phase === 'work' ? t('widgets.pomodoro.work') : t('widgets.pomodoro.break')}
      </p>
      <p className={cx('font-display tabular leading-none font-semibold', big ? 'text-5xl' : 'text-4xl')}>{formatClock(left)}</p>
      <div className="h-2 w-full max-w-48 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="flex gap-2">
        <Button
          variant="primary"
          icon={running ? Pause : Play}
          onClick={() => setConfig({ state: running ? pause(config.state, Date.now()) : start(config.state, Date.now()) })}
        >
          {running ? t('widgets.pomodoro.pause') : t('widgets.pomodoro.start')}
        </Button>
        <Button icon={RotateCcw} onClick={() => setConfig({ state: reset(config.workMin, config.state) })}>
          {t('widgets.pomodoro.reset')}
        </Button>
      </div>
      {big && <p className="text-xs text-faint">{t('widgets.pomodoro.completed', { n: config.state.completed })}</p>}
    </div>
  );
}

export function PomodoroSettings({ config, setConfig }: WidgetSettingsProps<PomodoroConfig>) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex items-center justify-between">
        {t('widgets.pomodoro.workMinutes')}
        <TextInput
          type="number"
          min={5}
          max={120}
          value={config.workMin}
          onChange={(e) => setConfig({ workMin: num(Number(e.target.value), 5, 120, 25) })}
          className="tabular w-20 text-right"
        />
      </label>
      <label className="flex items-center justify-between">
        {t('widgets.pomodoro.breakMinutes')}
        <TextInput
          type="number"
          min={1}
          max={60}
          value={config.breakMin}
          onChange={(e) => setConfig({ breakMin: num(Number(e.target.value), 1, 60, 5) })}
          className="tabular w-20 text-right"
        />
      </label>
    </div>
  );
}
