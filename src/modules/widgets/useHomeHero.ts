import { useEffect, useMemo, useState } from 'react';
import { t, type MessageKey } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { useSystemStats, percent } from '../system/systemService';
import { parseDateKey, sanitizeCalendar, toDateKey, type CalendarEvent } from './basic/calendar';
import { obj, type WidgetInstance } from './types';
import { loadCachedWeather, sanitizeCity, weatherLabelKey, type City, type Weather } from './weather/weatherService';

const DATE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
const SHORT_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

export function greetingKey(hour: number): MessageKey {
  if (hour >= 5 && hour < 12) return 'home.greetMorning';
  if (hour >= 12 && hour < 18) return 'home.greetDay';
  if (hour >= 18 && hour < 23) return 'home.greetEvening';
  return 'home.greetNight';
}

/** Şu andan sonraki ilk etkinlik (zamansız etkinlikler günün sonuna kadar geçerli). */
export function nextEvent(events: readonly CalendarEvent[], now: Date): CalendarEvent | null {
  const today = toDateKey(now);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const list = events
    .filter((e) => e.date > today || (e.date === today && (e.time === undefined || e.time >= hhmm)))
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.time ?? '99:99').localeCompare(b.time ?? '99:99')));
  return list[0] ?? null;
}

function eventWhen(ev: CalendarEvent, now: Date): string {
  const today = toDateKey(now);
  const tomorrow = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const day =
    ev.date === today ? t('home.today') : ev.date === tomorrow ? t('home.tomorrow') : (() => {
      const d = parseDateKey(ev.date);
      return d ? SHORT_FMT.format(d) : ev.date;
    })();
  return `${day} ${ev.time ?? t('home.allDay')}`;
}

export interface HeroData {
  now: Date;
  greeting: string;
  dateText: string;
  weather: { temp: string; label: string; city: string } | null;
  event: { when: string; title: string } | null;
  cpu: number | null;
  ram: number | null;
}

/** Ana ekran bandı verisi: saat, selamlama, hava (yalnız önbellekten), sıradaki etkinlik, CPU/RAM. */
export function useHomeHero(widgets: readonly WidgetInstance[], performanceMode: boolean, active: boolean): HeroData {
  const tick = useNow(performanceMode ? 30_000 : 1_000);
  const now = useMemo(() => new Date(tick), [tick]);
  const { stats } = useSystemStats(performanceMode ? 10_000 : 3_000, active);

  const city = useMemo<City | null>(() => {
    for (const w of widgets) {
      if (w.type !== 'weather' || w.disabled) continue;
      const c = sanitizeCity(obj(w.config).city);
      if (c) return c;
    }
    return null;
  }, [widgets]);
  const cityId = city ? `${city.lat},${city.lon}` : '';

  const [weather, setWeather] = useState<Weather | null>(null);
  const minuteKey = Math.floor(tick / 300_000);
  useEffect(() => {
    let alive = true;
    if (!city) {
      setWeather(null);
      return;
    }
    void loadCachedWeather(city)
      .then((w) => alive && setWeather(w))
      .catch(() => alive && setWeather(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, minuteKey]);

  const events = useMemo<CalendarEvent[]>(() => {
    const all: CalendarEvent[] = [];
    for (const w of widgets) if (w.type === 'calendar' && !w.disabled) all.push(...sanitizeCalendar(w.config).events);
    return all;
  }, [widgets]);
  const minute = Math.floor(tick / 60_000);
  const ev = useMemo(() => nextEvent(events, new Date(minute * 60_000)), [events, minute]);

  return {
    now,
    greeting: t(greetingKey(now.getHours())),
    dateText: DATE_FMT.format(now),
    weather:
      city && weather
        ? {
            temp: `${Math.round(weather.temperature)}°`,
            label: t(weatherLabelKey(weather.code)),
            city: city.name,
          }
        : null,
    event: ev ? { when: eventWhen(ev, now), title: ev.title } : null,
    cpu: stats && stats.cpu !== null ? Math.round(stats.cpu) : null,
    ram: stats ? percent(stats.memoryUsed, stats.memoryTotal) : null,
  };
}
