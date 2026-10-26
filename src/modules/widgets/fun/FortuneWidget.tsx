import { Cookie } from 'lucide-react';
import { t } from '../../../i18n';
import { usePersistentState } from '../../../shared/lib/usePersistentState';
import { Button } from '../../../shared/ui/primitives';
import { toDateKey } from '../basic/calendar';
import type { WidgetProps } from '../types';
import { fortuneForDay, sanitizeFortune, type FortuneState } from './fortune';

export type FortuneConfig = Record<string, never>;

/** Şans kurabiyesi: günde bir kez kırılır; sonuç yerel gün boyunca saklanır. */
export function FortuneWidget({ size }: WidgetProps<FortuneConfig>) {
  const [stored, setStored, loaded] = usePersistentState<FortuneState | null>('widgets.fortune', null, sanitizeFortune);
  const fortunes = t('widgets.fortune.lines').split('\n').map((s) => s.trim()).filter(Boolean);
  const today = toDateKey(new Date());
  const opened = stored !== null && stored.day === today;
  const text = opened ? (fortunes[Math.min(stored.index, fortunes.length - 1)] ?? '') : '';
  const big = size.h >= 3;

  const crack = () => {
    if (fortunes.length === 0) return;
    setStored(fortuneForDay(today, fortunes.length));
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      {opened ? (
        <>
          <Cookie size={big ? 48 : 36} className="shrink-0 text-accent" aria-hidden />
          <p className={big ? 'text-md leading-relaxed font-medium' : 'text-sm leading-relaxed font-medium'}>{text}</p>
          <p className="text-xs text-faint">{t('widgets.fortune.tomorrow')}</p>
        </>
      ) : (
        <>
          <Cookie size={big ? 96 : 64} className="shrink-0 text-accent" aria-hidden />
          <Button variant="primary" onClick={crack} disabled={!loaded || fortunes.length === 0}>
            {t('widgets.fortune.open')}
          </Button>
        </>
      )}
    </div>
  );
}
