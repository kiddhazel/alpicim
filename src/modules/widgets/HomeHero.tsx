import { CalendarClock, Cpu, MemoryStick, Thermometer } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../i18n';
import type { WidgetInstance } from './types';
import { useHomeHero } from './useHomeHero';

function Chip({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="glass flex h-10 items-center gap-2 rounded-2xl px-3.5 text-sm" title={label}>
      <span className="text-accent">{icon}</span>
      <span className="text-muted">{label}</span>
      <span className="max-w-64 truncate font-medium text-fg">{children}</span>
    </div>
  );
}

/** Ana ekranın üst bandı: selamlama, büyük saat ve kısa bilgi çipleri. */
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
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(h.now.getHours())}:${pad(h.now.getMinutes())}${performanceMode ? '' : `:${pad(h.now.getSeconds())}`}`;

  return (
    <section
      aria-label={t('home.hero')}
      className="relative mx-auto flex min-h-[180px] w-full max-w-[1600px] shrink-0 flex-wrap items-center justify-between gap-x-10 gap-y-4 overflow-hidden px-6 py-5"
    >
      {!performanceMode && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-[8%] h-56 w-[36rem] max-w-[70%] -translate-y-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
        />
      )}
      <div className="relative min-w-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{h.greeting}</h1>
        <p className="mt-1 text-base text-muted">{h.dateText}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {h.weather && (
            <Chip icon={<Thermometer size={16} />} label={h.weather.city}>
              {h.weather.temp} · {h.weather.label}
            </Chip>
          )}
          {h.event && (
            <Chip icon={<CalendarClock size={16} />} label={t('home.nextEvent')}>
              {h.event.when} · {h.event.title}
            </Chip>
          )}
          {h.cpu !== null && (
            <Chip icon={<Cpu size={16} />} label={t('home.cpu')}>
              <span className="tabular">%{h.cpu}</span>
            </Chip>
          )}
          {h.ram !== null && (
            <Chip icon={<MemoryStick size={16} />} label={t('home.ram')}>
              <span className="tabular">%{h.ram}</span>
            </Chip>
          )}
        </div>
      </div>
      <div className="relative font-display text-6xl font-semibold tracking-tight text-gradient tabular" aria-live="off">
        {time}
      </div>
    </section>
  );
}
