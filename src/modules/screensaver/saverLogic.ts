/** Ekran koruyucu: boşta kalma eşiği ve gösterim kararı (saf mantık). */

export const SCREENSAVER_MINUTES = [3, 5, 10, 15] as const;
export type ScreensaverMinutes = (typeof SCREENSAVER_MINUTES)[number];
export const DEFAULT_SCREENSAVER_MINUTES: ScreensaverMinutes = 5;
export const IDLE_EVENT = 'alpicim://idle';

export function sanitizeScreensaverMinutes(v: unknown): ScreensaverMinutes {
  return SCREENSAVER_MINUTES.includes(v as ScreensaverMinutes) ? (v as ScreensaverMinutes) : DEFAULT_SCREENSAVER_MINUTES;
}

export function idleReached(idleSeconds: number, minutes: number): boolean {
  return Number.isFinite(idleSeconds) && idleSeconds >= minutes * 60;
}

export interface SaverState {
  shown: boolean;
  /** Kapatıldıktan sonra, kullanıcı gerçekten etkin olana (boşta < eşik) kadar yeniden açılmaz. */
  armed: boolean;
}

export interface SaverInput {
  enabled: boolean;
  minutes: number;
  idleSeconds: number;
  mainVisible: boolean;
}

export const INITIAL_SAVER: SaverState = { shown: false, armed: true };

/** Boşta olayı geldiğinde yeni durum. */
export function nextSaverState(prev: SaverState, input: SaverInput): SaverState {
  const reached = idleReached(input.idleSeconds, input.minutes);
  if (!input.enabled) return { shown: false, armed: !reached };
  if (!reached) return { shown: false, armed: true };
  if (prev.shown) return input.mainVisible ? prev : { shown: false, armed: false };
  if (prev.armed && input.mainVisible) return { shown: true, armed: true };
  return prev;
}

/** Kullanıcı kapattı: boşta süre sıfırlanana dek yeniden açılma. */
export function dismissSaver(): SaverState {
  return { shown: false, armed: false };
}

/** Yavaş süzülen parçacıklar (konum yüzde, süre sn). */
export interface Mote {
  x: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
}

export function makeMotes(count: number, rng: () => number = Math.random): Mote[] {
  return Array.from({ length: count }, () => ({
    x: rng() * 100,
    size: 2 + rng() * 4,
    delay: -rng() * 40,
    duration: 28 + rng() * 32,
    drift: (rng() - 0.5) * 12,
  }));
}
