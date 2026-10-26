import { Bomb, Cat, Gem, Ghost, Heart, RotateCcw, Rocket, Star, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { track } from '../../shared/lib/track';
import { useInterval } from '../../shared/lib/hooks';
import { Button, cx } from '../../shared/ui/primitives';
import { chooseMemoryCard, observeCard } from './ai';
import type { AutoplayProps } from './autoplayTypes';
import { flip, isDone, newMemory, resolveMismatch, type MemoryState } from './memory';
import { Stat } from './Stat';

const ICONS: LucideIcon[] = [Rocket, Ghost, Heart, Star, Cat, Gem, Zap, Bomb];

function fmt(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function MemoryGame({ autoplay, scoreRef, onEnd }: AutoplayProps) {
  const [state, setState] = useState<MemoryState>(() => newMemory());
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const done = isDone(state);
  scoreRef.current = state.cards.filter((c) => c.matched).length / 2;
  const stateRef = useRef(state);
  stateRef.current = state;
  const playedRef = useRef(false);
  const winTracked = useRef(false);
  const known = useRef(new Map<number, number>());
  const prevAuto = useRef(autoplay);
  const snap = useRef<{ state: MemoryState; seconds: number; started: boolean } | null>(null);

  useInterval(() => setSeconds((s) => s + 1), started && !done ? 1000 : null);

  useEffect(() => {
    if (state.pending.length < 2) return;
    const id = window.setTimeout(() => setState((s) => resolveMismatch(s)), 800);
    return () => window.clearTimeout(id);
  }, [state.pending.length]);

  const reset = () => {
    playedRef.current = false;
    winTracked.current = false;
    known.current.clear();
    setState(newMemory());
    setSeconds(0);
    setStarted(false);
  };

  useEffect(() => {
    if (prevAuto.current === autoplay) return;
    prevAuto.current = autoplay;
    known.current.clear();
    if (autoplay) {
      snap.current = { state, seconds, started };
      if (done) reset();
    } else if (snap.current) {
      setState(snap.current.state);
      setSeconds(snap.current.seconds);
      setStarted(snap.current.started);
      snap.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => {
      const s = stateRef.current;
      const pick = chooseMemoryCard(s, known.current);
      if (pick === null) return;
      const card = s.cards[pick];
      if (card) observeCard(known.current, pick, card.pair);
      setStarted(true);
      setState((cur) => flip(cur, pick));
    }, 650);
    return () => window.clearInterval(id);
  }, [autoplay]);

  useEffect(() => {
    if (done && !autoplay && !winTracked.current) {
      winTracked.current = true;
      track('games.memory.win');
    }
  }, [done, autoplay]);

  useEffect(() => {
    if (autoplay && done) onEnd('win');
  }, [autoplay, done, onEnd]);
  const onFlip = (id: number) => {
    if (!playedRef.current) {
      playedRef.current = true;
      track('games.played');
    }
    setStarted(true);
    setState((s) => flip(s, id));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center gap-2">
        <Stat label={t('games.moves')} value={state.moves} />
        <Stat label={t('games.time')} value={fmt(seconds)} />
        <Button icon={RotateCcw} className="ml-auto" onClick={reset}>{t('games.newGame')}</Button>
      </div>
      <div className="glass relative grid grid-cols-4 gap-2 rounded-2xl p-2" role="grid" aria-label={t('games.board')}>
        {state.cards.map((c) => {
          const Icon = ICONS[c.pair % ICONS.length] as LucideIcon;
          const shown = c.open || c.matched;
          return (
            <button
              key={c.id}
              type="button"
              aria-label={`${t('games.card')} ${c.id + 1}`}
              aria-pressed={shown}
              onClick={() => onFlip(c.id)}
              className={cx(
                'flex aspect-square items-center justify-center rounded-xl transition-all duration-200',
                shown
                  ? c.matched
                    ? 'bg-accent-gradient text-white shadow-[0_0_16px_-4px_var(--accent)]'
                    : 'bg-surface-3 text-accent shadow-[inset_0_0_0_2px_var(--accent)]'
                  : 'bg-surface-2 text-transparent shadow-[0_3px_0_var(--border-strong)] hover:-translate-y-0.5 hover:bg-surface-3',
              )}
            >
              <Icon size={28} strokeWidth={2} />
            </button>
          );
        })}
        {done && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-bg/70 backdrop-blur-sm">
            <p className="text-gradient font-mono text-xl font-bold">{t('games.done')}</p>
            <p className="text-sm text-muted">{`${t('games.moves')}: ${state.moves} · ${t('games.time')}: ${fmt(seconds)}`}</p>
            <Button variant="primary" onClick={reset}>{t('games.again')}</Button>
          </div>
        )}
      </div>
      <p className="text-center text-sm text-muted">{t('games.hintMemory')}</p>
    </div>
  );
}
