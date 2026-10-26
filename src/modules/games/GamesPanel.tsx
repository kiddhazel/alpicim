import { Brain, Grid2x2, Hand, Hash, Skull, SpellCheck, Worm } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { Segmented } from '../../shared/ui/primitives';
import { Game2048 } from './Game2048';
import { HangmanGame } from './HangmanGame';
import { MemoryGame } from './MemoryGame';
import { RpsGame } from './RpsGame';
import { WordleGame } from './WordleGame';
import { XoxGame } from './XoxGame';
import { SnakeGame } from './SnakeGame';
import { useGameKeys } from './useGameKeys';

type GameId = 'g2048' | 'snake' | 'memory' | 'wordle' | 'rps' | 'xox' | 'hangman';
const AUTOPLAY_GAMES: readonly GameId[] = ['g2048', 'snake', 'memory'];
type PlayEnd = 'win' | 'lose' | 'stopped' | 'timeout';

const IDLE_MS = 20_000;

/** Oyunlar: çevrimdışı üç küçük oyun. Seçilen oyun dışındakiler bağlanmaz (klavye dinleyicisi çakışmaz). */
export function GamesPanel() {
  const [game, setGame] = useState<GameId>('g2048');
  const [autoplay, setAutoplay] = useState(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const autoRef = useRef(false);
  const scoreRef = useRef(0);
  const lastInput = useRef(Date.now());
  const timer = useRef<number | null>(null);

  const stop = useCallback((result: PlayEnd) => {
    if (!autoRef.current) return;
    autoRef.current = false;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setAutoplay(false);
    window.dispatchEvent(
      new CustomEvent('alpicim:laila-play-end', { detail: { game: gameRef.current, result, score: scoreRef.current } }),
    );
  }, []);

  const noteInput = useCallback(() => {
    lastInput.current = Date.now();
    stop('stopped');
  }, [stop]);

  const active = useGameKeys(() => {
    noteInput();
    return false;
  });
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!active) stop('stopped');
  }, [active, stop]);

  useEffect(() => {
    const onPlay = () => {
      if (!activeRef.current || autoRef.current || !AUTOPLAY_GAMES.includes(gameRef.current) || Date.now() - lastInput.current < IDLE_MS) return;
      autoRef.current = true;
      scoreRef.current = 0;
      setAutoplay(true);
      timer.current = window.setTimeout(() => stop('timeout'), 30_000 + Math.random() * 15_000);
    };
    window.addEventListener('alpicim:laila-play', onPlay);
    return () => {
      window.removeEventListener('alpicim:laila-play', onPlay);
      stop('stopped');
    };
  }, [stop]);

  const onEnd = useCallback((result: 'win' | 'lose') => stop(result), [stop]);
  const props = { autoplay, scoreRef, onEnd };

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-auto p-4" onPointerDownCapture={noteInput}>
      <div className="flex justify-center overflow-x-auto">
        <Segmented<GameId>
          label={t('games.picker')}
          value={game}
          onChange={setGame}
          options={[
            { value: 'g2048', label: t('games.g2048'), icon: Grid2x2 },
            { value: 'snake', label: t('games.snake'), icon: Worm },
            { value: 'memory', label: t('games.memory'), icon: Brain },
            { value: 'wordle', label: t('games.wordle'), icon: SpellCheck },
            { value: 'rps', label: t('games.rps'), icon: Hand },
            { value: 'xox', label: t('games.xox'), icon: Hash },
            { value: 'hangman', label: t('games.hangman'), icon: Skull },
          ]}
        />
      </div>
      {autoplay && (
        <div className="glass pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-sm font-medium text-fg">
          <span className="text-gradient">{t('games.lailaPlaying')}</span>
        </div>
      )}
      {game === 'g2048' && <Game2048 {...props} />}
      {game === 'snake' && <SnakeGame {...props} />}
      {game === 'memory' && <MemoryGame {...props} />}
      {game === 'wordle' && <WordleGame />}
      {game === 'rps' && <RpsGame />}
      {game === 'xox' && <XoxGame />}
      {game === 'hangman' && <HangmanGame />}
    </div>
  );
}
