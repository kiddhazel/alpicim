/** Ekran görüntüsü seçimi için saf yardımcılar (birim testli). */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sürükleme başlangıç/bitiş noktalarından, görünüm alanına sıkıştırılmış dikdörtgen. */
export function dragRect(a: Point, b: Point, bounds: { w: number; h: number }): Rect {
  const clampX = (v: number) => Math.min(Math.max(v, 0), bounds.w);
  const clampY = (v: number) => Math.min(Math.max(v, 0), bounds.h);
  const x0 = clampX(Math.min(a.x, b.x));
  const y0 = clampY(Math.min(a.y, b.y));
  const x1 = clampX(Math.max(a.x, b.x));
  const y1 = clampY(Math.max(a.y, b.y));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Seçim yeterince büyük mü (yanlışlıkla tıklamayı ayıklar)? */
export function isUsable(r: Rect, min = 6): boolean {
  return r.w >= min && r.h >= min;
}

/** Rust'a gönderilen oranlar: pencerenin genişlik/yüksekliğine göre 0..1 (karışık DPI'da güvenli). */
export function toFractions(r: Rect, bounds: { w: number; h: number }): { fx: number; fy: number; fw: number; fh: number } | null {
  if (bounds.w <= 0 || bounds.h <= 0) return null;
  return { fx: r.x / bounds.w, fy: r.y / bounds.h, fw: r.w / bounds.w, fh: r.h / bounds.h };
}
