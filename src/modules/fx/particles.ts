/** Saf parçacık matematiği (çizimden bağımsız, testli). */

export type FxKind =
  | 'rain' | 'snow' | 'cloud' | 'fog' | 'sun' | 'stars'
  | 'bats' | 'pumpkins' | 'ghost' | 'flags' | 'lights' | 'hearts'
  | 'balloons' | 'kites' | 'lanterns' | 'crescent' | 'fireworks'
  | 'none';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

/** WMO hava kodu + gündüz bilgisi → efekt türü. */
export function kindForWeather(code: number, isDay: boolean): FxKind {
  if (code === 0 || code === 1) return isDay ? 'sun' : 'stars';
  if (code === 2 || code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 51) return 'rain';
  return 'none';
}

/** Düşük yoğunluk: alan başına parçacık sayısı. */
export function particleCount(kind: FxKind, width: number, height: number): number {
  const area = (width * height) / 1_000_000;
  const per: Record<FxKind, number> = {
    rain: 55, snow: 40, cloud: 3, fog: 3, sun: 14, stars: 45,
    bats: 4, pumpkins: 3, ghost: 0.5, flags: 2.5, lights: 0, hearts: 7, balloons: 4, kites: 1.5, lanterns: 4.5, crescent: 0.5, fireworks: 0,
    none: 0,
  };
  const n = Math.round(per[kind] * Math.max(area, 0.3));
  return Math.max(per[kind] > 0 ? 1 : 0, Math.min(160, n));
}

/** `rnd` 0..1 üretir (test için enjekte edilebilir). */
export function spawn(kind: FxKind, width: number, height: number, rnd: () => number = Math.random): Particle {
  const x = rnd() * width;
  const y = rnd() * height;
  const phase = rnd() * Math.PI * 2;
  switch (kind) {
    case 'rain':
      return { x, y, vx: -40, vy: 420 + rnd() * 240, size: 10 + rnd() * 14, phase };
    case 'snow':
      return { x, y, vx: 0, vy: 30 + rnd() * 40, size: 1.5 + rnd() * 2, phase };
    case 'cloud':
    case 'fog':
      return { x, y, vx: 6 + rnd() * 10, vy: 0, size: 160 + rnd() * 220, phase };
    case 'sun':
      return { x, y, vx: 0, vy: 0, size: 1.5 + rnd() * 2, phase };
    case 'stars':
      return { x, y, vx: 0, vy: 0, size: 1 + rnd() * 1.5, phase };
    case 'bats':
      return { x, y, vx: (rnd() < 0.5 ? -1 : 1) * (45 + rnd() * 60), vy: 0, size: 18 + rnd() * 8, phase };
    case 'pumpkins':
      return { x, y, vx: 6 + rnd() * 8, vy: 0, size: 20 + rnd() * 6, phase };
    case 'ghost':
      return { x, y, vx: 22, vy: 0, size: 38, phase };
    case 'flags':
      return { x, y, vx: 14 + rnd() * 8, vy: 0, size: 26 + rnd() * 10, phase };
    case 'hearts':
      return { x, y, vx: 0, vy: -(24 + rnd() * 30), size: 16 + rnd() * 12, phase };
    case 'balloons':
      return { x, y, vx: 0, vy: -(18 + rnd() * 20), size: 30 + rnd() * 8, phase };
    case 'kites':
      return { x, y, vx: 18 + rnd() * 10, vy: 0, size: 32, phase };
    case 'lanterns':
      return { x, y, vx: 0, vy: -(8 + rnd() * 14), size: 24 + rnd() * 8, phase };
    case 'crescent':
      return { x: width * 0.85, y: height * 0.14, vx: 0, vy: 0, size: 56, phase };
    default:
      return { x, y, vx: 0, vy: 0, size: 1, phase };
  }
}

/** dt saniye. Ekran dışına çıkan parçacık karşı kenardan girer. */
export function step(p: Particle, kind: FxKind, dt: number, width: number, height: number): void {
  p.phase += dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (kind === 'snow') p.x += Math.sin(p.phase * 1.3) * 12 * dt;
  const pad = kind === 'cloud' || kind === 'fog' ? p.size : 20;
  if (p.y > height + pad) p.y = -pad;
  if (p.y < -pad) p.y = height + pad;
  if (p.x > width + pad) p.x = -pad;
  if (p.x < -pad) p.x = width + pad;
}

/** Yanıp sönme: 0..1 */
export function twinkle(p: Particle, speed = 1): number {
  return 0.5 + 0.5 * Math.sin(p.phase * speed);
}

/* ---- Konfeti ---- */

export interface Confetto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  life: number;
}

export function burst(count: number, x: number, y: number, colors: number, rnd: () => number = Math.random): Confetto[] {
  return Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.1;
    const speed = 220 + rnd() * 380;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.floor(rnd() * 3) * 2,
      color: Math.floor(rnd() * colors),
      life: 1.1 + rnd() * 0.7,
    };
  });
}

/** Yerçekimi + sürtünme; dt saniye. Ömrü bitince false. */
export function stepConfetto(c: Confetto, dt: number): boolean {
  c.vy += 900 * dt;
  c.vx *= Math.pow(0.35, dt);
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.life -= dt;
  return c.life > 0;
}
