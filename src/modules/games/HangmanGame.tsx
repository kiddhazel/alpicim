import { Heart, RotateCcw } from 'lucide-react';
import { useRef, useState } from 'react';
import { t } from '../../i18n';
import { track } from '../../shared/lib/track';
import { Button, cx } from '../../shared/ui/primitives';
import { LailaFace, type FaceMood } from './LailaFace';
import { hangmanGuess, hangmanStatus, HANGMAN_MAX_MISS, masked, misses, newHangman } from './mini';
import { useGameKeys } from './useGameKeys';
import { KEY_ROWS, keyToLetter } from './wordle';

export function HangmanGame() {
  const [h, setH] = useState(() => newHangman());
  const [mood, setMood] = useState<FaceMood>('look');
  const [line, setLine] = useState(t('games.say.start'));
  const played = useRef(false);
  const status = hangmanStatus(h);
  const left = HANGMAN_MAX_MISS - misses(h);

  const guess = (letter: string) => {
    if (status !== 'playing' || h.guessed.includes(letter)) return;
    if (!played.current) {
      played.current = true;
      track('games.played');
    }
    const next = hangmanGuess(h, letter);
    setH(next);
    const st = hangmanStatus(next);
    if (st === 'won') {
      track('games.mini.win');
      setMood('look');
      setLine(t('games.say.hangWin'));
    } else if (st === 'lost') {
      setMood('happy');
      setLine(t('games.say.hangLose'));
    } else if (next.word.includes(letter)) {
      setMood('blink');
      setLine(t('games.say.hangRight'));
    } else {
      setMood('look');
      setLine(t('games.say.hangWrong'));
    }
  };

  useGameKeys((e) => {
    const l = keyToLetter(e.key);
    if (!l) return false;
    guess(l);
    return true;
  });

  const reset = () => {
    setH(newHangman());
    setMood('look');
    setLine(t('games.say.start'));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-control px-3 py-2" aria-label={t('games.lives', { n: left })}>
          {Array.from({ length: HANGMAN_MAX_MISS }, (_, i) => (
            <Heart key={i} size={18} className={i < left ? 'fill-down text-down' : 'text-fg-3'} />
          ))}
        </div>
        <Button icon={RotateCcw} className="ml-auto" onClick={reset}>{status === 'playing' ? t('games.newGame') : t('games.again')}</Button>
      </div>
      <LailaFace mood={mood} line={line} />
      <div className="flex justify-center gap-2 py-3 text-2xl font-semibold">
        {masked(h).map((c, i) => (
          <span key={i} className="flex h-12 w-10 items-center justify-center rounded-lg bg-layer text-fg border-b-2 border-accent">
            {c === '_' ? '' : c}
          </span>
        ))}
      </div>
      {status === 'lost' && <p className="text-center text-sm text-fg-2">{t('games.wordWas', { word: h.word })}</p>}
      <div className="flex flex-col items-center gap-1.5">
        {KEY_ROWS.map((row) => (
          <div key={row} className="flex gap-1.5">
            {[...row].map((l) => {
              const used = h.guessed.includes(l);
              const hit = used && h.word.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  disabled={used || status !== 'playing'}
                  onClick={() => guess(l)}
                  className={cx(
                    'h-10 w-8 rounded-lg text-sm font-semibold transition-colors',
                    used ? (hit ? 'bg-up/30 text-fg' : 'bg-down/20 text-fg-3') : 'bg-layer text-fg hover:bg-control-hover',
                  )}
                >
                  {l}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-fg-2">{t('games.hintHangman')}</p>
    </div>
  );
}
