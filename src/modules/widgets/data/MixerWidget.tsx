import { AppWindow, Volume2, VolumeX } from 'lucide-react';
import { t } from '../../../i18n';
import { cx } from '../../../shared/ui/primitives';
import { describeError, StateView } from '../../../shared/ui/StateView';
import { fromPercent, MASTER_ID, toPercent } from '../../mixer/mixer';
import { useExeIcon, useMixer } from '../../mixer/mixerService';
import type { WidgetProps } from '../types';

interface RowProps {
  id: string;
  name: string;
  exe: string | null;
  volume: number;
  muted: boolean;
  active: boolean;
  master?: boolean;
  onVolume: (id: string, v: number) => void;
  onMute: (id: string, m: boolean) => void;
}

function Row({ id, name, exe, volume, muted, active, master, onVolume, onMute }: RowProps) {
  const icon = useExeIcon(exe);
  const pct = toPercent(volume);
  return (
    <li className={cx('flex items-center gap-2 px-1 py-1', !active && !master && 'opacity-60')}>
      {master ? (
        <Volume2 size={18} className="shrink-0 text-accent" />
      ) : icon ? (
        <img src={icon} alt="" width={18} height={18} className="shrink-0" draggable={false} />
      ) : (
        <AppWindow size={18} className="shrink-0 text-faint" />
      )}
      <span className="w-24 shrink-0 truncate text-sm" title={name}>
        {name}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        aria-label={t('widgets.mixer.volume', { name })}
        onChange={(e) => onVolume(id, fromPercent(Number(e.target.value)))}
        className="h-1 min-w-0 flex-1 accent-[var(--accent)]"
      />
      <span className="w-9 shrink-0 text-right text-xs text-muted tabular-nums">{pct}%</span>
      <button
        type="button"
        aria-label={t(muted ? 'widgets.mixer.unmute' : 'widgets.mixer.mute', { name })}
        aria-pressed={muted}
        onClick={() => onMute(id, !muted)}
        className={cx('shrink-0 rounded-lg p-1 hover:bg-surface-3', muted ? 'text-down' : 'text-muted hover:text-fg')}
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </li>
  );
}

export function MixerWidget({ active }: WidgetProps<Record<string, never>>) {
  const { state, loaded, error, setVolume, setMute } = useMixer(active);

  if (!loaded) {
    return error ? (
      <StateView compact kind="error" title={t('widgets.mixer.failed')} description={describeError(error).description} />
    ) : (
      <StateView compact kind="loading" title={t('common.loading')} />
    );
  }
  return (
    <ul className="flex h-full flex-col overflow-y-auto px-3 pb-2">
      <Row
        id={MASTER_ID}
        name={t('widgets.mixer.master')}
        exe={null}
        volume={state.master}
        muted={state.masterMuted}
        active
        master
        onVolume={setVolume}
        onMute={setMute}
      />
      {state.sessions.length === 0 && <li className="px-1 py-2 text-sm text-faint">{t('widgets.mixer.empty')}</li>}
      {state.sessions.map((s) => (
        <Row
          key={s.id}
          id={s.id}
          name={s.system ? t('widgets.mixer.system') : s.name}
          exe={s.exe}
          volume={s.volume}
          muted={s.muted}
          active={s.active}
          onVolume={setVolume}
          onMute={setMute}
        />
      ))}
    </ul>
  );
}
