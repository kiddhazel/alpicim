import type { HolidayId } from './holidays';
import { kindForWeather, type FxKind } from './particles';

export type Daypart = 'dawn' | 'day' | 'sunset' | 'night';
export type WeatherGroup = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'fog';

export const DAYPARTS: readonly Daypart[] = ['dawn', 'day', 'sunset', 'night'];

/** Saat → gün dilimi (yerel). */
export function daypartForHour(hour: number): Daypart {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'sunset';
  return 'night';
}

/** WMO hava kodu → ortam grubu. */
export function weatherGroup(code: number): WeatherGroup {
  if (code <= 1) return 'sunny';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (kindForWeather(code, true) === 'snow') return 'snow';
  return code >= 51 ? 'rain' : 'cloudy';
}

export interface SceneInput {
  daypart: Daypart;
  /** Hava verisi yoksa null. */
  weatherCode: number | null;
  holiday: HolidayId | null;
  weatherFx: boolean;
  ambientFx: boolean;
}

const HOLIDAY_KINDS: Record<HolidayId, readonly FxKind[]> = {
  halloween: ['bats', 'pumpkins', 'ghost'],
  republic: ['flags', 'fireworks'],
  newYear: ['snow', 'lights', 'fireworks'],
  christmas: ['snow', 'lights'],
  valentine: ['hearts'],
  children: ['balloons', 'kites'],
  ramadan: ['lanterns', 'crescent'],
  kurban: ['lanterns', 'crescent'],
};

/** Çizilecek katmanlar (yinelenmez). */
export function sceneKinds(i: SceneInput): FxKind[] {
  const out = new Set<FxKind>();
  const group = i.weatherCode === null ? null : weatherGroup(i.weatherCode);
  const precip = group === 'rain' || group === 'snow';
  if (i.weatherFx && i.weatherCode !== null && group !== 'sunny') {
    const k = kindForWeather(i.weatherCode, i.daypart !== 'night');
    if (k !== 'none') out.add(k);
  }
  if (i.weatherFx && group === 'sunny' && i.daypart !== 'night') out.add('sun');
  if (i.ambientFx && i.daypart === 'night' && !precip) out.add('stars');
  if (i.holiday) for (const k of HOLIDAY_KINDS[i.holiday]) out.add(k);
  return [...out];
}

/** Yılbaşı havai fişeği yalnız 31 Ara 23:00 – 1 Oca 01:00 arası (önizlemede her zaman). */
export function fireworksLive(holiday: HolidayId | null, date: Date, preview: boolean): boolean {
  if (holiday !== 'newYear') return holiday !== null;
  if (preview) return true;
  const m = date.getMonth();
  const d = date.getDate();
  const h = date.getHours();
  return (m === 11 && d === 31 && h >= 23) || (m === 0 && d === 1 && h < 1);
}

export type Tone = 'dawn' | 'sunset' | 'night' | 'gray';

/** Gün dilimi + hava → ton. Gündüz sakin havada nötr (null); bulutlu/yağışlı/sisli ise hafif gri. */
export function toneFor(daypart: Daypart, group: WeatherGroup | null): Tone | null {
  if (daypart === 'night') return 'night';
  if (daypart === 'dawn') return 'dawn';
  if (daypart === 'sunset') return 'sunset';
  return group && group !== 'sunny' ? 'gray' : null;
}
