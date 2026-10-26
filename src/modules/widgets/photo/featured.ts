import { AppError } from '../../../shared/lib/tauri';

/**
 * Wikimedia "günün öne çıkan görseli" (featured feed) → saf ayrıştırma.
 * Ağ çağrısı yok; yanıt gövdesi JSON olarak verilir. Bilinmeyen/eksik alan → null.
 */

export type PhotoLang = 'tr' | 'en';

export interface Photo {
  /** Yerel tarih, YYYY-MM-DD */
  day: string;
  lang: PhotoLang;
  /** upload.wikimedia.org (https) küçük boyutlu önizleme */
  thumbnail: string;
  /** Kısa açıklama (düz metin, en fazla 240 karakter) */
  description: string;
  /** Yazar/atıf metni; bilinmiyorsa boş */
  artist: string;
  /** commons.wikimedia.org dosya sayfası (lisans ayrıntıları) */
  filePage: string;
  fetchedAt: number;
}

const MAX_DESCRIPTION = 240;

/** Yalnızca https ve Wikimedia alan adları kabul edilir (açılan adres ve görsel). */
export function isWikimediaUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && (u.hostname === 'wikimedia.org' || u.hostname.endsWith('.wikimedia.org'));
  } catch {
    return false;
  }
}

function text(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
}

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function obj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/**
 * Featured feed yanıtından görseli çıkarır. `image` yoksa veya önizleme/dosya sayfası
 * güvenli (https + wikimedia) değilse null döner.
 */
export function parseFeatured(json: unknown, day: string, lang: PhotoLang = 'tr', now = Date.now()): Photo | null {
  const image = obj(obj(json).image);
  const thumb = obj(image.thumbnail).source ?? obj(image.image).source;
  const filePage = image.file_page;
  if (!isWikimediaUrl(thumb) || !isWikimediaUrl(filePage)) return null;
  return {
    day,
    lang,
    thumbnail: thumb,
    description: clip(text(obj(image.description).text), MAX_DESCRIPTION),
    artist: clip(text(obj(image.artist).text), 120),
    filePage,
    fetchedAt: now,
  };
}

export function parseFeaturedBody(body: string, day: string, lang: PhotoLang, now = Date.now()): Photo | null {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new AppError('PARSE');
  }
  return parseFeatured(data, day, lang, now);
}

/** Yerel takvim gününü YYYY-MM-DD olarak verir. */
export function localDay(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Feed uç noktası: /feed/v1/wikipedia/{lang}/featured/YYYY/MM/DD */
export function featuredUrl(lang: PhotoLang, day: string): string {
  const [y, m, d] = day.split('-');
  return `https://api.wikimedia.org/feed/v1/wikipedia/${lang}/featured/${y}/${m}/${d}`;
}
