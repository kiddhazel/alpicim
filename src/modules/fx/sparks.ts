/** Havai fişek kıvılcımları (saf). */

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

export function explode(x: number, y: number, count = 36, rnd: () => number = Math.random): Spark[] {
  const hue = Math.floor(rnd() * 360);
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.2;
    const sp = 70 + rnd() * 110;
    return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9 + rnd() * 0.7, hue };
  });
}

export function stepSpark(s: Spark, dt: number): boolean {
  s.vy += 70 * dt;
  s.vx *= Math.pow(0.5, dt);
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.life -= dt;
  return s.life > 0;
}
