import { AppError } from '../../shared/lib/tauri';
import { netGet } from '../../shared/lib/net';
import { assertIntegrationEnabled } from '../integrations/integrationsService';
import { buildSearchUrl, CURATED_STATIONS, parseStations, pickCurated, type ParsedStations, type RadioStation, type SearchOptions } from './radio';

/** Radio Browser araması (anahtarsız). */
export async function searchStations(opts: SearchOptions): Promise<ParsedStations> {
  await assertIntegrationEnabled('radiobrowser');
  const res = await netGet({ url: buildSearchUrl(opts) });
  if (!res.ok) throw new AppError('HTTP', String(res.status));
  let json: unknown;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new AppError('PARSE', 'radio');
  }
  return parseStations(json);
}

let curatedCache: RadioStation[] | null = null;

/** Hazır listedeki adları tek tek arayıp çözer; bulunamayanlar atlanır. Oturum boyunca önbelleklenir. */
export async function loadCurated(): Promise<RadioStation[]> {
  if (curatedCache) return curatedCache;
  const found = await Promise.all(
    CURATED_STATIONS.map(async (name) => {
      try {
        const { stations } = await searchStations({ name, limit: 8 });
        return pickCurated(stations, name);
      } catch (err) {
        if (err instanceof AppError && err.code === 'DISABLED') throw err;
        return null;
      }
    }),
  );
  const out = found.filter((s): s is RadioStation => s !== null);
  if (out.length > 0) curatedCache = out;
  return out;
}
