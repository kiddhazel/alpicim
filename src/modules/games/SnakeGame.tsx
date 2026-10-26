import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { track, trackMax } from '../../shared/lib/track';
import { Button } from '../../shared/ui/primitives';
import { Stat } from './Stat';
import { chooseSnakeDir } from './ai';
import type { AutoplayProps } from './autoplayTypes';
import { initSnake, step, tickMs, type SnakeDir, type SnakeState } from './snake';
import { swipeHandlers, useGameKeys } from './useGameKeys';

const CELL = 24;
const KEYS: Record<string, SnakeDir> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down',
};

function cssVar(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

export function SnakeGame({ autoplay, scoreRef, onEnd }: AutoplayProps) {
  const [state, setState] = useState<SnakeState>(() => initSnake());
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(0);
  const dirRef = useRef<SnakeDir>('right');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playedRef = useRef(false);
  const autoRef = useRef(autoplay);
  autoRef.current = autoplay;
  scoreRef.current = state.score;

  const steer = (d: SnakeDir) => {
    dirRef.current = d;
    if (!state.over) setRunning(true);
  };
  const reset = () => {
    playedRef.current = false;
    dirRef.current = 'right';
    setState(initSnake());
    setRunning(false);
  };

  const active = useGameKeys((e) => {
    if (autoRef.current) return false;
    if (e.key === ' ') {
      if (state.over) reset();
      else setRunning((r) => !r);
      return true;
    }
    const d = KEYS[e.key];
    if (!d) return false;
    steer(d);
    return true;
  });

  // Panel gizlenince duraklat.
  useEffect(() => {
    if (!active) setRunning(false);
  }, [active]);

  useEffect(() => {
    if (running && !autoRef.current && !playedRef.current) {
      playedRef.current = true;
      track('games.played');
    }
  }, [running]);

  useEffect(() => {
    if (!running || state.over) return;
    const id = window.setTimeout(() => setState((s) => step(s, autoRef.current ? chooseSnakeDir(s) : dirRef.current)), tickMs(state.score));
    return () => window.clearTimeout(id);
  }, [running, state]);

  useEffect(() => {
    if (state.over) {
      setRunning(false);
      if (!autoRef.current) {
        setBest((b) => Math.max(b, state.score));
        trackMax('games.snake.score', state.score);
      }
    }
  }, [state.over, state.score]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const accent = cssVar(canvas, '--accent', '#7c5cff');
    const accent2 = cssVar(canvas, '--text', '#f2f2f4');
    const down = cssVar(canvas, '--down', '#ef4444');
    const line = cssVar(canvas, '--border', 'rgba(255,255,255,0.08)');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    for (let x = 1; x < state.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let y = 1; y < state.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(canvas.width, y * CELL + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = down;
    ctx.fillRect(state.food.x * CELL + 4, state.food.y * CELL + 4, CELL - 8, CELL - 8);
    state.body.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? accent2 : accent;
      ctx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i * 0.03);
      ctx.fillRect(p.x * CELL + 2, p.y * CELL + 2, CELL - 4, CELL - 4);
    });
    ctx.globalAlpha = 1;
  }, [state]);

  const prevAuto = useRef(autoplay);
  const snap = useRef<SnakeState | null>(null);
  useEffect(() => {
    if (prevAuto.current === autoplay) return;
    prevAuto.current = autoplay;
    if (autoplay) {
      snap.current = state;
      if (state.over) reset();
      setRunning(true);
    } else if (snap.current) {
      dirRef.current = snap.current.dir;
      setState(snap.current);
      setRunning(false);
      snap.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  useEffect(() => {
    if (autoplay && state.over) onEnd('lose');
  }, [autoplay, state.over, onEnd]);

  const swipe = swipeHandlers(steer);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <Stat label={t('games.score')} value={state.score} />
        <Stat label={t('games.best')} value={Math.max(best, state.score)} />
        <div className="ml-auto flex gap-2">
          <Button icon={running ? Pause : Play} onClick={() => setRunning((r) => !r)} disabled={state.over}>
            {running ? t('games.pause') : t('games.resume')}
          </Button>
          <Button icon={RotateCcw} onClick={reset}>{t('games.newGame')}</Button>
        </div>
      </div>
      <div className="relative rounded-xl bg-layer touch-none select-none overflow-hidden rounded-xl p-1.5" {...swipe}>
        <canvas
          ref={canvasRef}
          width={state.cols * CELL}
          height={state.rows * CELL}
          aria-label={t('games.board')}
          className="block h-auto w-full rounded-xl bg-layer"
        />
        {(!running || state.over) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/60">
            <p className="text-lg font-semibold">
              {state.over ? t('games.snakeOver') : state.score > 0 ? t('games.paused') : t('games.start')}
            </p>
            {state.over && <Button variant="primary" onClick={reset}>{t('games.again')}</Button>}
          </div>
        )}
      </div>
      <p className="text-center text-sm text-fg-2">{t('games.hintSnake')}</p>
    </div>
  );
}
