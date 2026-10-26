import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../i18n';
import { useNow } from '../../../shared/lib/hooks';
import { usePersistentState } from '../../../shared/lib/usePersistentState';
import { Button, cx, Segmented } from '../../../shared/ui/primitives';
import { toDateKey } from '../basic/calendar';
import type { WidgetProps } from '../types';
import { dailyProverb, EMPTY_QUIZ, makeQuestion, recordAnswer, sanitizeQuiz, type QuizQuestion, type QuizState } from './proverb';
import { PROVERBS, type ProverbEntry } from './proverbs';

export type ProverbConfig = Record<string, never>;

type Mode = 'daily' | 'quiz';

/** Atasözü ve deyim: günün sözü (anlamı tıklayınca açılır) ya da 4 şıklı anlam sınavı. */
export function ProverbWidget({ size }: WidgetProps<ProverbConfig>) {
  const now = useNow(60_000);
  const today = toDateKey(new Date(now));
  const [mode, setMode] = useState<Mode>('daily');
  const big = size.h >= 3;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-3 pb-3">
      <div className="flex justify-center">
        <Segmented<Mode>
          label={t('widgets.proverb.title')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'daily', label: t('widgets.proverb.daily'), icon: ScrollText },
            { value: 'quiz', label: t('widgets.proverb.quiz') },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mode === 'daily' ? <DailyCard key={today} day={today} big={big} /> : <QuizCard big={big} />}
      </div>
    </div>
  );
}

function kindLabel(entry: ProverbEntry): string {
  return entry.kind === 'atasözü' ? t('widgets.proverb.kindProverb') : t('widgets.proverb.kindIdiom');
}

function DailyCard({ day, big }: { day: string; big: boolean }) {
  const entry = dailyProverb(PROVERBS, day);
  const [revealed, setRevealed] = useState(false);
  if (!entry) return null;
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-2.5 text-center">
      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{kindLabel(entry)}</span>
      <p className={cx('font-semibold leading-snug', big ? 'text-base' : 'text-sm')}>{entry.text}</p>
      {revealed ? (
        <p className="text-sm leading-relaxed text-fg-2" aria-live="polite">
          <span className="font-semibold text-fg">{t('widgets.proverb.meaningLabel')}: </span>
          {entry.meaning}
        </p>
      ) : null}
      <Button variant="ghost" aria-expanded={revealed} onClick={() => setRevealed((v) => !v)}>
        {revealed ? t('widgets.proverb.hide') : t('widgets.proverb.reveal')}
      </Button>
    </div>
  );
}

function QuizCard({ big }: { big: boolean }) {
  const [stored, setStored] = usePersistentState<QuizState>('proverb.quiz', EMPTY_QUIZ, sanitizeQuiz);
  const [question, setQuestion] = useState<QuizQuestion | null>(() => makeQuestion(PROVERBS));
  const [picked, setPicked] = useState<number | null>(null);

  if (!question) return null;
  const answered = picked !== null;
  const isRight = picked === question.answer;

  const choose = (index: number) => {
    if (answered) return;
    setPicked(index);
    setStored((prev) => recordAnswer(prev, index === question.answer));
  };

  const next = () => {
    setQuestion(makeQuestion(PROVERBS));
    setPicked(null);
  };

  return (
    <div className="flex min-h-full flex-col gap-2.5">
      <p className="text-center text-xs text-fg-3">
        {kindLabel(question.entry)} · {t('widgets.proverb.quizQuestion')}
      </p>
      <p className={cx('text-center font-semibold leading-snug', big ? 'text-base' : 'text-sm')}>{question.entry.text}</p>
      <ul className="flex flex-col gap-1.5">
        {question.choices.map((choice, i) => {
          const isAnswer = i === question.answer;
          const isPicked = i === picked;
          return (
            <li key={choice}>
              <button
                type="button"
                disabled={answered && !isAnswer && !isPicked}
                onClick={() => choose(i)}
                className={cx(
                  'w-full rounded-xl px-3 py-2 text-left text-sm leading-snug shadow-[inset_0_0_0_1px_var(--stroke)] transition-colors',
                  !answered && 'hover:bg-accent-soft',
                  answered && isAnswer && 'bg-accent-soft text-fg',
                  answered && isPicked && !isAnswer && 'bg-control text-warn',
                )}
              >
                {choice}
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        <p className={cx('text-sm font-semibold', isRight ? 'text-up' : 'text-warn')} aria-live="polite">
          {isRight ? t('widgets.proverb.correct') : t('widgets.proverb.wrong', { meaning: question.entry.meaning })}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-fg-3">{t('widgets.proverb.score', { correct: stored.correct, answered: stored.answered })}</span>
        <div className="flex gap-1.5">
          <Button variant="ghost" onClick={() => setStored(EMPTY_QUIZ)} disabled={stored.answered === 0}>
            {t('widgets.proverb.resetScore')}
          </Button>
          {answered && (
            <Button variant="primary" onClick={next}>
              {t('widgets.proverb.next')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
