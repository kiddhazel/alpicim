import { RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { track } from '../../shared/lib/track';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { Button } from '../../shared/ui/primitives';
import { choose2048 } from './ai';
import type { AutoplayProps } from './autoplayTypes';
import { addTile, canMove, hasWon, move, newGame, type Board, type Dir } from './g2048';
import { Stat } from './Stat';
import { swipeHandlers, useGameKeys } from './useGameKeys';

const KEYS: Record<string, Dir> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down',
};

function tileStyle(v: number): React.CSSProperties {
  if (v === 0) return {};
  const pct = Math.min(100, 14 + Math.log2(v) * 8);
  return {
    background: `color-mix(in srgb, var(--accent) ${pct}%, var(--card))`,
    color: pct > 55 ? 'var(--on-accent)' : 'var(--text)',
  };
}

export function Game2048({ autoplay, scoreRef, onEnd }: AutoplayProps) {
  const [board, setBoard] = useState<Board>(() => newGame());
  const [score, setScore] = useState(0);
  const [best, setBest] = usePersistentState<number>('games.best', 0, (raw) => (typeof raw === 'number' && raw >= 0 ? raw : 0));
  const [over, setOver] = useState(false);
  const stateRef = useRef({ board, over });
  stateRef.current = { board, over };
  scoreRef.current = score;
  const autoRef = useRef(autoplay);
  autoRef.current = autoplay;

  const playedRef = useRef(false);
  const wonTracked = useRef(false);
  const play = useCallback((dir: Dir) => {
    const { board: b, over: o } = stateRef.current;
    if (o) return;
    const r = move(b, dir);
    if (!r.moved) return;
    if (!autoRef.current && !playedRef.current) {
      playedRef.current = true;
      track('games.played');
    }
    const next = addTile(r.board);
    setBoard(next);
    setScore((s) => s + r.gained);
    if (!canMove(next)) setOver(true);
  }, []);

  useEffect(() => {
    if (!autoRef.current && score > best) setBest(score);
  }, [score, best, setBest]);

  useGameKeys((e) => {
    if (autoRef.current) return false;
    const d = KEYS[e.key];
    if (!d) return false;
    play(d);
    return true;
  });

  const reset = () => {
    playedRef.current = false;
    wonTracked.current = false;
    setBoard(newGame());
    setScore(0);
    setOver(false);
  };
  const won = hasWon(board);

  // Laila başlarken kullanıcının oyunu saklanır, bitince aynen geri gelir.
  const prevAuto = useRef(autoplay);
  const snap = useRef<{ board: Board; score: number; over: boolean } | null>(null);
  useEffect(() => {
    if (prevAuto.current === autoplay) return;
    prevAuto.current = autoplay;
    if (autoplay) {
      snap.current = { board, score, over };
      if (over || won) reset();
    } else if (snap.current) {
      setBoard(snap.current.board);
      setScore(snap.current.score);
      setOver(snap.current.over);
      snap.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  useEffect(() => {
    if (!autoplay) return;
    const id = window.setInterval(() => {
      const d = choose2048(stateRef.current.board);
      if (d) play(d);
    }, 400);
    return () => window.clearInterval(id);
  }, [autoplay, play]);

  useEffect(() => {
    if (won && !autoplay && !wonTracked.current) {
      wonTracked.current = true;
      track('games.2048.win');
    }
  }, [won, autoplay]);

  useEffect(() => {
    if (autoplay && (over || won)) onEnd(won ? 'win' : 'lose');
  }, [autoplay, over, won, onEnd]);
  const swipe = swipeHandlers(play);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center gap-2">
        <Stat label={t('games.score')} value={score} />
        <Stat label={t('games.best')} value={Math.max(best, score)} />
        <Button icon={RotateCcw} className="ml-auto" onClick={reset}>{t('games.newGame')}</Button>
      </div>
      <div
        role="grid"
        aria-label={t('games.board')}
        {...swipe}
        className="relative grid touch-none select-none grid-cols-4 gap-2 rounded-xl bg-layer p-2"
      >
        {board.flat().map((v, i) => (
          <div
            key={i}
            style={tileStyle(v)}
            className="flex aspect-square items-center justify-center rounded-lg bg-control font-mono text-xl font-semibold tabular-nums transition-colors"
          >
            {v || ''}
          </div>
        ))}
        {(over || won) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-bg/80">
            <p className="text-lg font-semibold">{over ? t('games.lost') : t('games.win')}</p>
            <Button variant="primary" onClick={reset}>{t('games.again')}</Button>
          </div>
        )}
      </div>
      <p className="text-center text-sm text-fg-2">{t('games.hint2048')}</p>
    </div>
  );
}
