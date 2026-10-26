/** Masaüstü Laila için saf çıkıntı (pencere üst kenarı) mantığı. Koordinatlar fiziksel pikseldir. */

export interface Ledge {
  x: number;
  y: number;
  width: number;
}

export interface MonitorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MAX_LEDGES = 30;

/** Ham listeden Laila'nın üstüne çıkabileceği çıkıntıları seçer ve ekrana kırpar. */
export function usableLedges(raw: readonly Ledge[], mon: MonitorBox, spriteW: number, spriteH: number): Ledge[] {
  const out: Ledge[] = [];
  const minY = mon.y + spriteH + 8; // üstünde sprite için yer olmalı
  const maxY = mon.y + mon.height - spriteH * 0.6; // yerden en az biraz yüksekte olmalı
  for (const l of raw) {
    if (![l.x, l.y, l.width].every(Number.isFinite)) continue;
    const left = Math.max(l.x, mon.x);
    const right = Math.min(l.x + l.width, mon.x + mon.width);
    const width = right - left;
    if (width < spriteW * 1.5 || l.y < minY || l.y > maxY) continue;
    out.push({ x: left, y: l.y, width });
    if (out.length >= MAX_LEDGES) break;
  }
  return out;
}

/** Üzerinde durulan çıkıntının yeni listedeki karşılığı; pencere kımıldadıysa/yoksa null (düşer). */
export function matchLedge(prev: Ledge, list: readonly Ledge[], centerX: number, tol: number): Ledge | null {
  let best: Ledge | null = null;
  let bestDy = Infinity;
  for (const l of list) {
    const dy = Math.abs(l.y - prev.y);
    if (dy > tol || centerX < l.x || centerX > l.x + l.width) continue;
    if (dy < bestDy) {
      best = l;
      bestDy = dy;
    }
  }
  return best;
}

export interface JumpTarget {
  ledge: Ledge;
  /** Sprite sol kenarının iniş konumu. */
  tx: number;
}

export interface JumpFrom {
  x: number;
  /** Sprite alt kenarı (ayak) ekran y'si. */
  feet: number;
  spriteW: number;
  scale: number;
}

/** Erişilebilir (en çok ~420 mantıksal px yükseklik/yanal mesafe, en az 24 px yükselme) çıkıntılardan birini seçer. */
export function pickJumpTarget(
  ledges: readonly Ledge[],
  me: JumpFrom,
  current: Ledge | null,
  rng: () => number = Math.random,
): JumpTarget | null {
  const reach = 420 * me.scale;
  const minRise = 24 * me.scale;
  const cx = me.x + me.spriteW / 2;
  const cands = ledges.filter((l) => {
    if (current && l.x === current.x && l.y === current.y && l.width === current.width) return false;
    const rise = me.feet - l.y;
    if (rise < minRise || rise > reach) return false;
    const gap = cx < l.x ? l.x - cx : cx > l.x + l.width ? cx - (l.x + l.width) : 0;
    return gap <= reach;
  });
  if (cands.length === 0) return null;
  const ledge = cands[Math.min(cands.length - 1, Math.floor(rng() * cands.length))] as Ledge;
  const lo = ledge.x;
  const hi = ledge.x + ledge.width - me.spriteW;
  return { ledge, tx: Math.min(hi, Math.max(lo, me.x)) };
}

/** Ayaklar `fromFeet`'ten `toFeet` ekran y'sine inerken yoldaki ilk çıkıntı (düşerken konma). */
export function landingLedge(
  ledges: readonly Ledge[],
  centerX: number,
  fromFeet: number,
  toFeet: number,
): Ledge | null {
  let best: Ledge | null = null;
  for (const l of ledges) {
    if (centerX < l.x || centerX > l.x + l.width) continue;
    if (l.y >= fromFeet && l.y <= toFeet && (best === null || l.y < best.y)) best = l;
  }
  return best;
}
