/** Radyo: Radio Browser yanıtlarını ayrıştırma, URL kurma, favoriler (saf mantık). */

export interface RadioStation {
  id: string;
  name: string;
  /** Yalnız https akış adresi. */
  url: string;
  favicon: string;
  tags: string;
  codec: string;
  bitrate: number;
}

export const RADIO_API = 'https://de1.api.radio-browser.info/json';

/** Hazır liste: adlarıyla aranıp çözülür. */
export const CURATED_STATIONS: readonly string[] = [
  'Power FM',
  'Kral FM',
  'Radyo Eksen',
  'Virgin Radio',
  'TRT FM',
  'Number One FM',
  'Radyo D',
  'Metro FM',
];

export interface SearchOptions {
  name?: string;
  tag?: string;
  country?: string;
  limit?: number;
}

export function buildSearchUrl(opts: SearchOptions = {}): string {
  const p = new URLSearchParams();
  const name = opts.name?.trim();
  const tag = opts.tag?.trim();
  if (name) p.set('name', name);
  if (tag) p.set('tag', tag);
  if (opts.country !== '') p.set('countrycode', opts.country ?? 'TR');
  p.set('hidebroken', 'true');
  p.set('order', 'clickcount');
  p.set('reverse', 'true');
  p.set('limit', String(Math.min(Math.max(opts.limit ?? 60, 1), 200)));
  return `${RADIO_API}/stations/search?${p.toString()}`;
}

export function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ParsedStations {
  stations: RadioStation[];
  /** Yalnız http akışı olduğu için atlananlar. */
  skippedHttp: number;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Radio Browser JSON dizisini temizler; yalnız https akışları tutar, kimliğe göre tekilleştirir. */
export function parseStations(raw: unknown): ParsedStations {
  const stations: RadioStation[] = [];
  let skippedHttp = 0;
  const seen = new Set<string>();
  if (!Array.isArray(raw)) return { stations, skippedHttp };
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = str(o.stationuuid);
    const name = str(o.name).replace(/\s+/g, ' ');
    const url = str(o.url_resolved) || str(o.url);
    if (!id || !name || !url || seen.has(id)) continue;
    if (!isHttps(url)) {
      if (/^http:\/\//i.test(url)) skippedHttp++;
      continue;
    }
    seen.add(id);
    const favicon = str(o.favicon);
    stations.push({
      id,
      name,
      url,
      favicon: isHttps(favicon) ? favicon : '',
      tags: str(o.tags),
      codec: str(o.codec),
      bitrate: typeof o.bitrate === 'number' && o.bitrate > 0 ? o.bitrate : 0,
    });
  }
  return { stations, skippedHttp };
}

function norm(s: string): string {
  return s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/[^a-z0-9ğüşöçi]+/g, ' ').trim();
}

/** Arama sonuçlarından hazır liste adına en uygun istasyonu seçer (sonuçlar zaten tıklanmaya göre sıralı). */
export function pickCurated(results: readonly RadioStation[], wanted: string): RadioStation | null {
  const w = norm(wanted);
  const exact = results.find((s) => norm(s.name) === w);
  if (exact) return exact;
  return results.find((s) => norm(s.name).startsWith(w)) ?? results.find((s) => norm(s.name).includes(w)) ?? null;
}

export function sanitizeFavorites(raw: unknown): RadioStation[] {
  if (!Array.isArray(raw)) return [];
  const out: RadioStation[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = str(o.id);
    const name = str(o.name);
    const url = str(o.url);
    if (!id || !name || !isHttps(url) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name,
      url,
      favicon: isHttps(str(o.favicon)) ? str(o.favicon) : '',
      tags: str(o.tags),
      codec: str(o.codec),
      bitrate: typeof o.bitrate === 'number' ? o.bitrate : 0,
    });
  }
  return out.slice(0, 200);
}

export function toggleFavorite(favs: readonly RadioStation[], station: RadioStation): RadioStation[] {
  return favs.some((f) => f.id === station.id) ? favs.filter((f) => f.id !== station.id) : [station, ...favs].slice(0, 200);
}
