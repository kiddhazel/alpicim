import { Target } from 'lucide-react';
import { t } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { remainingLabel } from './focus';
import { useFocus } from './useFocus';

/** Alt çubuk çipi: odak modu açıkken kalan süre (pomodoro) veya "Odak"; tıklayınca kapatır. */
export function FocusChip() {
  const { focus, toggle } = useFocus();
  const now = useNow(focus.on && focus.endsAt !== null ? 1000 : 60_000);
  if (!focus.on) return null;
  const left = remainingLabel(focus.endsAt, now);
  return (
    <button
      type="button"
      onClick={toggle}
      title={t('focus.chipHint')}
      className="bg-accent-soft text-accent hover:bg-control flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors"
    >
      <Target size={16} />
      <span>{t('focus.chip')}</span>
      {left && <span className="tabular">{left}</span>}
    </button>
  );
}
