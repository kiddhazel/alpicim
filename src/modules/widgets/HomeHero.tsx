import { CalendarClock, Cpu, MemoryStick, Thermometer, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../i18n';
import { Badge } from '../../shared/ui/primitives';
import type { WidgetInstance } from './types';
import { useHomeHero } from './useHomeHero';

function Chip({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <Badge title={label}>
      <Icon size={12} strokeWidth={1.75} aria-hidden />
      <span className="max-w-64 truncate tabular-nums">{children}</span>
    </Badge>
  );
}

/** Ana ekranın üst bandı: selamlama, tarih satırı ve kısa bilgi rozetleri. */
export function HomeHero({
  widgets,
  performanceMode,
  active,
}: {
  widgets: readonly WidgetInstance[];
  performanceMode: boolean;
  active: boolean;
}) {
  const h = useHomeHero(widgets, performanceMode, active);

  return (
    <section
      aria-label={t('home.hero')}
      className="mx-auto flex w-full max-w-[1600px] shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-3 px-6 pt-6 pb-4"
    >
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold">{h.greeting}</h1>
        <p className="text-sm text-fg-2 first-letter:uppercase">{h.dateText}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {h.weather && (
            <Chip icon={Thermometer} label={h.weather.city}>
              {h.weather.temp} · {h.weather.label}
            </Chip>
          )}
          {h.event && (
            <Chip icon={CalendarClock} label={t('home.nextEvent')}>
              {h.event.when} · {h.event.title}
            </Chip>
          )}
          {h.cpu !== null && (
            <Chip icon={Cpu} label={t('home.cpu')}>
              {t('home.cpu')} %{h.cpu}
            </Chip>
          )}
          {h.ram !== null && (
            <Chip icon={MemoryStick} label={t('home.ram')}>
              {t('home.ram')} %{h.ram}
            </Chip>
          )}
        </div>
      </div>
    </section>
  );
}
