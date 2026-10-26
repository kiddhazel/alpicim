import { Dices, Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../../i18n';
import { usePersistentState } from '../../../shared/lib/usePersistentState';
import { Button, cx, IconButton, Segmented, TextInput } from '../../../shared/ui/primitives';
import { celebrate } from '../../fx/confetti';
import {
  addItem,
  bumpEpisode,
  defaultWatchlist,
  nextSeason,
  pickWinner,
  planned,
  progressLabel,
  removeItem,
  sanitizeWatchlist,
  setStatus,
  spinDelays,
  spinSequence,
  WATCH_STATUSES,
  type WatchKind,
  type WatchlistState,
  type WatchStatus,
} from '../../watchlist/watchlist';
import type { WidgetProps } from '../types';

export type WatchlistConfig = Record<string, never>;

/** Film/dizi izleme listesi + "Bu akşam ne izlesem?" çarkı. */
export function WatchlistWidget({ size }: WidgetProps<WatchlistConfig>) {
  const [state, setState] = usePersistentState<WatchlistState>('widgets.watchlist', defaultWatchlist(), sanitizeWatchlist);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<WatchKind>('film');
  const [filter, setFilter] = useState<WatchStatus>('planned');
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const pool = planned(state.items);
  const visible = state.items.filter((i) => i.status === filter);
  const compact = size.h < 4;

  const add = () => {
    const id = `w${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
    setState((s) => ({ items: addItem(s.items, title, kind, id) }));
    setTitle('');
  };

  const spin = () => {
    if (spinning || pool.length === 0) return;
    const win = pickWinner(pool.length);
    const seq = spinSequence(pool.length, win);
    const delays = spinDelays(seq.length);
    setSpinning(true);
    setWinner(null);
    let i = 0;
    const step = () => {
      const item = pool[seq[i] ?? 0];
      setShown(item?.title ?? null);
      i++;
      if (i < seq.length) {
        timer.current = window.setTimeout(step, delays[i] ?? 200);
      } else {
        setSpinning(false);
        setWinner(item?.id ?? null);
        const r = wheelRef.current?.getBoundingClientRect();
        celebrate(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined);
      }
    };
    step();
  };

  const statusLabel = (s: WatchStatus) => t(`widgets.watchlist.status.${s}`);

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div
        ref={wheelRef}
        className={cx(
          'flex shrink-0 items-center gap-2 rounded-xl bg-surface-2 px-3',
          compact ? 'h-12' : 'h-16',
        )}
        aria-live="polite"
      >
        <Dices size={22} aria-hidden className={cx('shrink-0 text-accent', spinning && 'animate-spin')} />
        <p
          className={cx(
            'min-w-0 flex-1 truncate font-semibold transition-transform',
            compact ? 'text-sm' : 'text-md',
            spinning && 'scale-105 text-muted',
            winner && !spinning && 'text-gradient',
          )}
        >
          {shown ? (winner && !spinning ? t('widgets.watchlist.tonight', { title: shown }) : shown) : t('widgets.watchlist.prompt')}
        </p>
        <Button variant="primary" onClick={spin} disabled={spinning || pool.length === 0}>
          {spinning ? t('widgets.watchlist.spinning') : t('widgets.watchlist.spin')}
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <TextInput
          className="min-w-0 flex-1"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder={t('widgets.watchlist.placeholder')}
          aria-label={t('widgets.watchlist.placeholder')}
        />
        <Segmented<WatchKind>
          label={t('widgets.watchlist.kind')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'film', label: t('widgets.watchlist.film') },
            { value: 'dizi', label: t('widgets.watchlist.dizi') },
          ]}
        />
        <IconButton icon={Plus} label={t('widgets.watchlist.add')} onClick={add} disabled={!title.trim()} />
      </div>

      <Segmented<WatchStatus>
        label={t('widgets.watchlist.statusLabel')}
        value={filter}
        onChange={setFilter}
        options={WATCH_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
      />

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 && <li className="py-3 text-center text-sm text-faint">{t('widgets.watchlist.empty')}</li>}
        {visible.map((i) => (
          <li key={i.id} className={cx('flex items-center gap-1 rounded-lg px-1 py-1', winner === i.id && 'bg-accent-soft')}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={i.title}>
                {i.title}
              </p>
              <p className="text-xs text-faint">
                {t(`widgets.watchlist.${i.kind}`)}
                {i.kind === 'dizi' && ` · ${progressLabel(i)}`}
              </p>
            </div>
            {i.kind === 'dizi' && (
              <>
                <IconButton size="sm" icon={Minus} label={t('widgets.watchlist.episodeDown')} onClick={() => setState((s) => ({ items: bumpEpisode(s.items, i.id, -1) }))} />
                <IconButton size="sm" icon={Plus} label={t('widgets.watchlist.episodeUp')} onClick={() => setState((s) => ({ items: bumpEpisode(s.items, i.id, 1) }))} />
                <Button onClick={() => setState((s) => ({ items: nextSeason(s.items, i.id) }))}>{t('widgets.watchlist.nextSeason')}</Button>
              </>
            )}
            <select
              className="h-[30px] rounded-lg bg-surface-2 px-1 text-sm"
              value={i.status}
              aria-label={t('widgets.watchlist.statusLabel')}
              onChange={(e) => setState((s) => ({ items: setStatus(s.items, i.id, e.target.value as WatchStatus) }))}
            >
              {WATCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
            <IconButton size="sm" tone="danger" icon={Trash2} label={t('common.remove')} onClick={() => setState((s) => ({ items: removeItem(s.items, i.id) }))} />
          </li>
        ))}
      </ul>
    </div>
  );
}
