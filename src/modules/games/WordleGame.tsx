import { Delete, Share2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';
import { track } from '../../shared/lib/track';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { Button, cx } from '../../shared/ui/primitives';
import { useToast } from '../../shared/ui/Toast';
import { Stat } from './Stat';
import { useGameKeys } from './useGameKeys';
import {
  dailyWord, dayKey, EMPTY_STATS, evaluate, isValidGuess, KEY_ROWS, keyStates, keyToLetter, MAX_TRIES, recordResult, sanitizeDay,
  sanitizeStats, shareText, statusOf, trUpper, WORD_LEN, type LetterState, type WordleDay,
} from './wordle';

const CELL: Record<LetterState, string> = {
  correct: 'bg-up text-on-accent',
  present: 'bg-warn text-on-accent',
  absent: 'bg-control text-fg-2',
};

export function WordleGame() {
  const today = useMemo(() => dayKey(), []);
  const answer = useMemo(() => dailyWord(today), [today]);
  const [day, setDay, loaded] = usePersistentState<WordleDay>(
    'games.wordle.day',
    { day: today, guesses: [], status: 'playing' },
    (raw) => sanitizeDay(raw, today),
  );
  const [stats, setStats] = usePersistentState('games.wordle.stats', EMPTY_STATS, sanitizeStats);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const toast = useToast();
  const msgTimer = useRef<number | null>(null);

  const flash = (text: string) => {
    setMsg(text);
    if (msgTimer.current !== null) window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMsg(''), 1800);
  };

  const playing = loaded && day.status === 'playing';

  const type = (letter: string) => {
    if (!playing) return;
    setInput((s) => ([...s].length < WORD_LEN ? s + letter : s));
  };
  const erase = () => setInput((s) => [...s].slice(0, -1).join(''));
  const submit = () => {
    if (!playing) return;
    if ([...input].length < WORD_LEN) return flash(t('games.wordleShort'));
    if (!isValidGuess(input)) return flash(t('games.wordleNotWord'));
    if (day.guesses.length === 0) track('games.played');
    const guesses = [...day.guesses, trUpper(input)];
    const status = statusOf(guesses, answer);
    setDay({ day: today, guesses, status });
    setInput('');
    if (status !== 'playing') {
      setStats((s) => recordResult(s, today, status === 'won', guesses.length));
      if (status === 'won') track('games.wordle.win');
    }
  };

  useGameKeys((e) => {
    if (e.key === 'Enter') {
      submit();
      return true;
    }
    if (e.key === 'Backspace') {
      erase();
      return true;
    }
    const l = keyToLetter(e.key);
    if (!l) return false;
    type(l);
    return true;
  });

  const states = useMemo(() => keyStates(day.guesses, answer), [day.guesses, answer]);

  const share = () => {
    const text = shareText(day.guesses, answer, today);
    try {
      void navigator.clipboard
        ?.writeText(text)
        .then(() => toast.push('success', t('games.shareCopied')))
        .catch(() => undefined);
    } catch {
      /* pano yoksa sessizce geç */
    }
  };

  const rows = Array.from({ length: MAX_TRIES }, (_, r) => {
    const guess = day.guesses[r];
    if (guess) {
      const ev = evaluate(guess, answer);
      return [...guess].map((ch, i) => ({ ch, state: ev[i] as LetterState }));
    }
    const letters = r === day.guesses.length && playing ? [...input] : [];
    return Array.from({ length: WORD_LEN }, (_, i) => ({ ch: letters[i] ?? '', state: null as LetterState | null }));
  });

  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center gap-2">
        <Stat label={t('games.statsStreak')} value={stats.streak} />
        <Stat label={t('games.statsWinPct')} value={winPct} />
        <Stat label={t('games.statsPlayed')} value={stats.played} />
      </div>
      <div className="relative" role="grid" aria-label={t('games.board')}>
        <div className="mx-auto grid w-full max-w-xs gap-1.5">
          {rows.map((row, r) => (
            <div key={r} className="grid grid-cols-5 gap-1.5">
              {row.map((c, i) => (
                <div
                  key={i}
                  className={cx(
                    'flex aspect-square items-center justify-center rounded-lg text-lg font-semibold',
                    c.state ? CELL[c.state] : c.ch ? 'bg-control text-fg shadow-[inset_0_0_0_2px_var(--accent)]' : 'bg-layer text-fg',
                  )}
                >
                  {c.ch}
                </div>
              ))}
            </div>
          ))}
        </div>
        {msg && (
          <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-raised ring-1 ring-stroke-strong px-3 py-1 text-sm text-fg">{msg}</div>
        )}
      </div>
      {loaded && day.status !== 'playing' && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-lg font-semibold">
            {day.status === 'won' ? t('games.wordleWon') : t('games.wordleLost', { word: answer })}
          </p>
          <p className="text-sm text-fg-2">{t('games.wordleTomorrow')}</p>
          <Button icon={Share2} variant="primary" onClick={share}>{t('games.share')}</Button>
        </div>
      )}
      <div className="flex flex-col items-center gap-1.5">
        {KEY_ROWS.map((row, ri) => (
          <div key={row} className="flex gap-1">
            {ri === 2 && (
              <button type="button" onClick={submit} className="h-10 rounded-lg bg-accent text-on-accent px-2 text-sm font-semibold">
                {t('games.enter')}
              </button>
            )}
            {[...row].map((l) => {
              const s = states.get(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => type(l)}
                  className={cx(
                    'h-10 w-7 rounded-lg text-sm font-semibold transition-colors sm:w-8',
                    s ? CELL[s] : 'bg-layer text-fg hover:bg-control-hover',
                  )}
                >
                  {l}
                </button>
              );
            })}
            {ri === 2 && (
              <button type="button" onClick={erase} aria-label={t('games.backspace')} className="flex h-10 w-10 items-center justify-center rounded-lg bg-layer text-fg hover:bg-control-hover">
                <Delete size={18} strokeWidth={1.75} />
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-fg-2">{t('games.hintWordle')}</p>
    </div>
  );
}
