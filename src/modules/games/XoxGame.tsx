import { Circle, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { track } from '../../shared/lib/track';
import { Button, cx } from '../../shared/ui/primitives';
import { LailaFace, pick, type FaceMood } from './LailaFace';
import { emptyTtt, lailaTtt, tttWinner, type TttBoard } from './mini';
import { Stat } from './Stat';

export function XoxGame() {
  const [board, setBoard] = useState<TttBoard>(emptyTtt);
  const [score, setScore] = useState({ you: 0, laila: 0, draw: 0 });
  const [mood, setMood] = useState<FaceMood>('look');
  const [line, setLine] = useState(t('games.say.start'));
  const played = useRef(false);
  const scored = useRef<string | null>(null);
  const winner = tttWinner(board);
  const xCount = board.filter((m) => m === 'X').length;
  const oCount = board.filter((m) => m === 'O').length;
  const lailaTurn = !winner && xCount > oCount;

  useEffect(() => {
    if (!lailaTurn) return;
    setLine(t('games.say.thinking'));
    const id = window.setTimeout(() => {
      setBoard((b) => {
        const i = lailaTtt(b);
        if (i < 0) return b;
        return b.map((m, j) => (j === i ? 'O' : m));
      });
    }, 500);
    return () => window.clearTimeout(id);
  }, [lailaTurn]);

  useEffect(() => {
    if (!winner) {
      scored.current = null;
      return;
    }
    if (scored.current) return;
    scored.current = winner;
    setScore((s) => ({
      you: s.you + (winner === 'X' ? 1 : 0),
      laila: s.laila + (winner === 'O' ? 1 : 0),
      draw: s.draw + (winner === 'draw' ? 1 : 0),
    }));
    if (winner === 'X') {
      track('games.mini.win');
      setMood('look');
      setLine(t(pick(['games.say.lailaLose1', 'games.say.lailaLose2'] as const)));
    } else if (winner === 'O') {
      setMood('happy');
      setLine(t(pick(['games.say.lailaWin1', 'games.say.lailaWin2'] as const)));
    } else {
      setMood('blink');
      setLine(t(pick(['games.say.draw1', 'games.say.draw2'] as const)));
    }
  }, [winner]);

  const click = (i: number) => {
    if (winner || lailaTurn || board[i]) return;
    if (!played.current) {
      played.current = true;
      track('games.played');
    }
    setBoard((b) => b.map((m, j) => (j === i ? 'X' : m)));
  };
  const reset = () => {
    setBoard(emptyTtt());
    setMood('look');
    setLine(t('games.say.start'));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center gap-2">
        <Stat label={t('games.you')} value={score.you} />
        <Stat label={t('games.laila')} value={score.laila} />
        <Stat label={t('games.draws')} value={score.draw} />
        <Button icon={RotateCcw} className="ml-auto" onClick={reset}>{winner ? t('games.again') : t('games.newGame')}</Button>
      </div>
      <LailaFace mood={mood} line={line} />
      <div role="grid" aria-label={t('games.board')} className="mx-auto rounded-xl bg-layer grid w-full max-w-xs grid-cols-3 gap-2 rounded-xl p-2">
        {board.map((m, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${t('games.card')} ${i + 1}`}
            onClick={() => click(i)}
            className={cx(
              'flex aspect-square items-center justify-center rounded-xl bg-layer transition-colors',
              !m && !winner && !lailaTurn && 'hover:bg-control-hover',
              m === 'X' ? 'text-accent' : 'text-fg-2',
            )}
          >
            {m === 'X' && <X size={36} strokeWidth={2.5} />}
            {m === 'O' && <Circle size={32} strokeWidth={2.5} />}
          </button>
        ))}
      </div>
      <p className="text-center text-sm text-fg-2">{t('games.hintXox')}</p>
    </div>
  );
}
