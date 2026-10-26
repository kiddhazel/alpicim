import { Flag, Ghost, Gift, Heart, Moon, PartyPopper, Snowflake, Sparkles, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { t, type MessageKey } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { useSettings } from '../settings/settings';
import { currentHoliday, type HolidayId } from './holidays';

const ICONS: Record<HolidayId, LucideIcon> = {
  halloween: Ghost,
  republic: Flag,
  newYear: PartyPopper,
  christmas: Snowflake,
  valentine: Heart,
  children: Gift,
  ramadan: Moon,
  kurban: Sparkles,
};

/** Bugünün özel günü (ayar kapalıysa null). Shell/Ana ekran hem simgeyi hem selamı buradan alır. */
export function useHoliday(): HolidayId | null {
  const [settings] = useSettings();
  const now = useNow(60 * 60_000);
  return useMemo(() => (settings.fxHolidays ? currentHoliday(new Date(now)) : null), [settings.fxHolidays, now]);
}

/** Özel gün için küçük, tek renkli simge + tek satır selam (tam ekran süs yok). Özel gün yoksa hiçbir şey çizmez. */
export function HolidayMark({ iconOnly, className }: { iconOnly?: boolean; className?: string }) {
  const holiday = useHoliday();
  if (!holiday) return null;
  const Icon = ICONS[holiday];
  const text = t(`fx.greeting.${holiday}` as MessageKey);
  return (
    <span className={className ?? 'inline-flex items-center gap-1.5 text-sm text-fg-2'} title={text}>
      <Icon size={16} aria-hidden className="shrink-0 text-accent" />
      {!iconOnly && <span>{text}</span>}
    </span>
  );
}
