import { netGetOk } from '../../../shared/lib/net';
import { readKey, writeKey } from '../../../shared/lib/store';
import { AppError } from '../../../shared/lib/tauri';
import { assertIntegrationEnabled } from '../../integrations/integrationsService';
import { featuredUrl, localDay, parseFeaturedBody, type Photo, type PhotoLang } from './featured';

/**
 * Günün fotoğrafı: Wikimedia featured feed (anahtarsız). Önce Türkçe, görsel yoksa İngilizce.
 * Sonuç günlük önbelleğe yazılır (`photo.cache`); aynı gün içinde ağa tekrar çıkılmaz.
 * Kaynak Ayarlar → Entegrasyonlar'dan kapatılmışsa `DISABLED` hatası verilir (ağa çıkılmaz).
 */

export const PHOTO_CACHE_KEY = 'photo.cache';

/** `photo` boşsa o gün için görsel bulunamamıştır (tekrar denenmez). */
export interface PhotoCache {
  day: string;
  photo: Photo | null;
}

const LANGS: readonly PhotoLang[] = ['tr', 'en'];

export async function readCachedPhoto(day: string = localDay()): Promise<PhotoCache | null> {
  const cache = await readKey<PhotoCache | null>(PHOTO_CACHE_KEY, null);
  if (!cache || typeof cache !== 'object' || cache.day !== day) return null;
  return cache;
}

export async function fetchPhoto(day: string = localDay()): Promise<Photo | null> {
  await assertIntegrationEnabled('wikimedia');
  let photo: Photo | null = null;
  let answered = false;
  let lastError: unknown = null;
  for (const lang of LANGS) {
    try {
      const res = await netGetOk({ url: featuredUrl(lang, day) });
      answered = true;
      photo = parseFeaturedBody(res.body, day, lang);
      if (photo) break;
    } catch (err) {
      lastError = err;
    }
  }
  // Hiçbir dil yanıt vermediyse önbelleğe yazılmaz; bir sonraki denemede yeniden sorulur.
  if (!answered) throw lastError instanceof AppError ? lastError : new AppError('HTTP');
  await writeKey<PhotoCache>(PHOTO_CACHE_KEY, { day, photo });
  return photo;
}
