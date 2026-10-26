import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Search, Sun, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../../i18n';
import { useInterval, useNow } from '../../../shared/lib/hooks';
import { formatRelative } from '../../../shared/lib/time';
import { Button, Segmented, TextInput } from '../../../shared/ui/primitives';
import { describeError, StateView } from '../../../shared/ui/StateView';
import { getIntegration, isUsable } from '../../integrations/registry';
import { useIntegrations } from '../../integrations/useIntegrations';
import { useSettings } from '../../settings/settings';
import { num, obj, type WidgetProps, type WidgetSettingsProps } from '../types';
import {
  fetchWeather,
  loadCachedWeather,
  sanitizeCity,
  searchCities,
  WEATHER_SOURCES,
  weatherLabelKey,
  type City,
  type Weather,
  type WeatherSource,
} from './weatherService';

export interface WeatherConfig {
  city: City | null;
  refreshMinutes: number;
  /** Veri kaynağı (Ayarlar → Entegrasyonlar'da açık ve gerekiyorsa anahtarı kayıtlı olmalı). */
  source: WeatherSource;
}

export const weatherDefaults: WeatherConfig = { city: null, refreshMinutes: 30, source: 'openmeteo' };

export function sanitizeWeather(raw: unknown): WeatherConfig {
  const r = obj(raw);
  const source = WEATHER_SOURCES.find((s) => s === r.source) ?? 'openmeteo';
  return { city: sanitizeCity(r.city), refreshMinutes: num(r.refreshMinutes, 15, 180, 30), source };
}

const sourceName = (s: WeatherSource) => t(getIntegration(s).name);

function iconFor(code: number, isDay: boolean): LucideIcon {
  if (code === 0) return isDay ? Sun : Moon;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return CloudRain;
}

const DAY = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });

export function WeatherWidget({ config, setConfig, size, active }: WidgetProps<WeatherConfig>) {
  const [settings] = useSettings();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState<unknown>(null);
  const now = useNow();
  const city = config.city;
  const source = config.source;
  const integrations = useIntegrations();
  const sourceStatus = integrations.status(source);
  const usable = isUsable(sourceStatus);

  const refresh = useCallback(async () => {
    if (!city || !usable) return;
    try {
      setWeather(await fetchWeather(city, source));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [city, source, usable]);

  useEffect(() => {
    if (!city || !usable) return;
    let alive = true;
    void loadCachedWeather(city, source).then((cached) => {
      if (!alive) return;
      setWeather(cached);
      const maxAge = config.refreshMinutes * 60_000;
      if (!cached || Date.now() - cached.fetchedAt > maxAge) void refresh();
    });
    return () => {
      alive = false;
    };
  }, [city, source, usable, config.refreshMinutes, refresh]);

  const factor = settings.performanceMode ? 2 : 1;
  useInterval(() => void refresh(), active && city && usable ? config.refreshMinutes * 60_000 * factor : null);

  if (sourceStatus === null) return <StateView compact kind="loading" title={t('common.loading')} />;
  if (sourceStatus === 'off') {
    return <StateView compact kind="setup" title={t('errors.disabledTitle')} description={t('errors.disabledBody')} />;
  }
  if (sourceStatus === 'keyRequired') {
    return <StateView compact kind="setup" title={t('errors.keyTitle')} description={t('errors.keyBody')} />;
  }
  if (!city) return <CityPicker source={source} onPick={(c) => setConfig({ city: c })} />;
  if (!weather) {
    return error ? (
      <StateView compact kind="error" title={t('weather.failed')} description={describeError(error).description} />
    ) : (
      <StateView compact kind="loading" title={t('common.loading')} />
    );
  }

  const Icon = iconFor(weather.code, weather.isDay);
  const large = size.w >= 6 || size.h >= 3;
  return (
    <div className="flex h-full flex-col gap-2 px-4 py-2">
      <div className="flex items-center gap-3">
        <Icon size={large ? 40 : 32} strokeWidth={1.5} className="shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="font-display tabular-nums text-4xl leading-none font-semibold">{Math.round(weather.temperature)}°</p>
          <p className="mt-1 truncate text-sm text-fg-2">{t(weatherLabelKey(weather.code))}</p>
        </div>
        <div className="ml-auto min-w-0 text-right text-xs text-fg-2">
          <p className="truncate font-semibold text-fg">{city.name}</p>
          {weather.apparent !== null && <p>{t('weather.feels', { n: Math.round(weather.apparent) })}</p>}
          {weather.wind !== null && <p>{t('weather.wind', { n: Math.round(weather.wind) })}</p>}
        </div>
      </div>
      {large && weather.daily.length > 1 && (
        <ul className="grid grid-cols-4 gap-2 text-center text-xs">
          {weather.daily.slice(0, 4).map((d) => {
            const DayIcon = iconFor(d.code, true);
            return (
              <li key={d.date} className="rounded-lg bg-control py-1.5">
                <p className="text-fg-2">{DAY.format(new Date(`${d.date}T12:00:00`))}</p>
                <DayIcon size={15} className="mx-auto my-0.5 text-fg-2" />
                <p className="tabular-nums">
                  {Math.round(d.max)}° <span className="text-fg-3">{Math.round(d.min)}°</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-auto truncate text-xs text-fg-3" title={error ? describeError(error).description : undefined}>
        {t('weather.source', { source: sourceName(source), time: formatRelative(weather.fetchedAt, now) })}
        {error ? ` · ${t('weather.stale')}` : ''}
      </p>
    </div>
  );
}

function CityPicker({ source, onPick }: { source: WeatherSource; onPick: (c: City) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<City[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    setError(null);
    try {
      setResults(await searchCities(q, source));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto px-4 py-2">
      <p className="text-sm text-fg-2">{t('weather.chooseCity')}</p>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('weather.cityPlaceholder')} className="min-w-0 flex-1" />
        <Button type="submit" icon={Search} disabled={busy || q.trim().length < 2}>
          {t('weather.search')}
        </Button>
      </form>
      {error ? <p className="text-xs text-down">{describeError(error).description}</p> : null}
      {results && results.length === 0 && <p className="text-xs text-fg-3">{t('weather.noCity')}</p>}
      <ul className="flex flex-col gap-1">
        {results?.map((c) => (
          <li key={`${c.lat},${c.lon}`}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className="w-full rounded-lg bg-control px-3 py-2 text-left text-sm transition-colors hover:bg-control-hover"
            >
              {c.name}
              <span className="text-fg-2"> · {[c.admin, c.country].filter(Boolean).join(', ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WeatherSettings({ config, setConfig }: WidgetSettingsProps<WeatherConfig>) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-sm font-semibold">{t('integrations.weatherSource')}</p>
        <Segmented<WeatherSource>
          label={t('integrations.weatherSource')}
          value={config.source}
          onChange={(v) => setConfig({ source: v })}
          options={WEATHER_SOURCES.map((s) => ({ value: s, label: sourceName(s) }))}
        />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">{t('weather.city')}</p>
        {config.city ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{config.city.name}</span>
            <Button onClick={() => setConfig({ city: null })}>{t('weather.change')}</Button>
          </div>
        ) : (
          <p className="text-sm text-fg-2">{t('weather.chooseCity')}</p>
        )}
      </div>
      <label className="flex items-center justify-between gap-2 text-sm">
        {t('widgets.refreshMinutes')}
        <TextInput
          type="number"
          min={15}
          max={180}
          value={config.refreshMinutes}
          onChange={(e) => setConfig({ refreshMinutes: num(Number(e.target.value), 15, 180, 30) })}
          className="tabular-nums w-20 text-right"
        />
      </label>
      <p className="text-xs text-fg-3">{t('weather.terms')}</p>
    </div>
  );
}
