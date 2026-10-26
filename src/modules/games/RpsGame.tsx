import { Hand, Mountain, RotateCcw, Scissors, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { t } from '../../i18n';
import { track } from '../../shared/lib/track';
import { Button } from '../../shared/ui/primitives';
import { LailaFace, pick, type FaceMood } from './LailaFace';
import { lailaRps, rpsOutcome, RPS_ALL, type Rps } from './mini';
import { Stat } from './Stat';

const ICON: Record<Rps, LucideIcon> = { rock: Mountain, paper: Hand, scissors: Scissors };
const LABEL = { rock: 'games.rock', paper: 'games.paper', scissors: 'games.scissors' } as const;

function Pic({ m }: { m: Rps | null }) {
  const Icon = m ? ICON[m] : null;
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-layer text-accent">
      {Icon ? <Icon size={36} strokeWidth={1.75} /> : <span className="font-mono text-xl text-fg-2">?</span>}
    </div>
  );
}

export function RpsGame() {
  const [score, setScore] = useState({ you: 0, laila: 0, draw: 0 });
  const [last, setLast] = useState<{ user: Rps; laila: Rps } | null>(null);
  const [mood, setMood] = useState<FaceMood>('look');
  const [line, setLine] = useState(t('games.say.start'));
  const played = useRef(false);

  const play = (user: Rps) => {
    if (!played.current) {
      played.current = true;
      track('games.played');
    }
    const { move, cheated } = lailaRps(user);
    const out = rpsOutcome(user, move);
    setLast({ user, laila: move });
    setScore((s) => ({
      you: s.you + (out === 'win' ? 1 : 0),
      laila: s.laila + (out === 'lose' ? 1 : 0),
      draw: s.draw + (out === 'draw' ? 1 : 0),
    }));
    if (out === 'win') track('games.mini.win');
    if (cheated) {
      setMood('blink');
      setLine(t('games.say.cheat'));
    } else if (out === 'lose') {
      setMood('happy');
      setLine(t(pick(['games.say.lailaWin1', 'games.say.lailaWin2'] as const)));
    } else if (out === 'win') {
      setMood('look');
      setLine(t(pick(['games.say.lailaLose1', 'games.say.lailaLose2'] as const)));
    } else {
      setMood('blink');
      setLine(t(pick(['games.say.draw1', 'games.say.draw2'] as const)));
    }
  };

  const reset = () => {
    setScore({ you: 0, laila: 0, draw: 0 });
    setLast(null);
    setMood('look');
    setLine(t('games.say.start'));
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center gap-2">
        <Stat label={t('games.you')} value={score.you} />
        <Stat label={t('games.laila')} value={score.laila} />
        <Stat label={t('games.draws')} value={score.draw} />
        <Button icon={RotateCcw} className="ml-auto" onClick={reset}>{t('games.newGame')}</Button>
      </div>
      <LailaFace mood={mood} line={line} />
      <div className="flex items-center justify-center gap-6 py-2">
        <Pic m={last?.user ?? null} />
        <span className="font-mono text-lg text-fg-2">vs</span>
        <Pic m={last?.laila ?? null} />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {RPS_ALL.map((m) => (
          <Button key={m} icon={ICON[m]} variant="primary" onClick={() => play(m)}>{t(LABEL[m])}</Button>
        ))}
      </div>
      <p className="text-center text-sm text-fg-2">{t('games.hintRps')}</p>
    </div>
  );
}
