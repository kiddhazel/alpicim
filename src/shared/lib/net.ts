import { AppError, call, isTauri } from './tauri';

export interface NetRequest {
  url: string;
  etag?: string | null;
  lastModified?: string | null;
  /** Anahtarı Rust tarafında eklenecek sağlayıcı (ör. "twelvedata"). */
  provider?: string;
}

export interface NetResponse {
  status: number;
  ok: boolean;
  notModified: boolean;
  body: string;
  etag: string | null;
  lastModified: string | null;
  contentType: string | null;
}

/**
 * Tüm ağ istekleri Rust'taki `net_get` komutundan geçer (zaman aşımı, boyut sınırı, koşullu istek).
 * Vite önizlemesinde doğrudan fetch denenir; CORS nedeniyle çoğu kaynak orada çalışmayabilir.
 */
export async function netGet(request: NetRequest): Promise<NetResponse> {
  if (isTauri()) {
    return call<NetResponse>('net_get', { request });
  }
  if (request.provider) throw new AppError('NOT_DESKTOP');
  try {
    const res = await fetch(request.url);
    return {
      status: res.status,
      ok: res.ok,
      notModified: res.status === 304,
      body: await res.text(),
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      contentType: res.headers.get('content-type'),
    };
  } catch (err) {
    throw new AppError('OFFLINE', err instanceof Error ? err.message : String(err));
  }
}

/** Başarısız HTTP durumlarını AppError'a çevirir. */
export async function netGetOk(request: NetRequest): Promise<NetResponse> {
  const res = await netGet(request);
  if (!res.ok && !res.notModified) {
    if (res.status === 429) throw new AppError('RATE_LIMIT', `HTTP ${res.status}`);
    throw new AppError('HTTP', `HTTP ${res.status}`);
  }
  return res;
}

/** Basit eşzamanlılık sınırlayıcı: aynı anda en fazla `limit` görev. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}
