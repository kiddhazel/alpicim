import { readKey, writeKey } from '../../shared/lib/store';
import { AppError } from '../../shared/lib/tauri';
import { netGet } from '../../shared/lib/net';
import { parsePodcast, type PodcastFeed } from '../news/rss';
import { assertIntegrationEnabled } from '../integrations/integrationsService';
import { audioService } from '../radio/audioService';
import { buildItunesUrl, parseItunes, sanitizePositions, savePosition, type PodcastHit } from './podcasts';

export const POSITIONS_KEY = 'podcasts.positions';

export async function fetchPodcast(url: string): Promise<PodcastFeed> {
  await assertIntegrationEnabled('podcasts');
  const res = await netGet({ url });
  if (!res.ok) throw new AppError('HTTP', String(res.status));
  return parsePodcast(res.body);
}

export async function searchPodcasts(term: string): Promise<PodcastHit[]> {
  await assertIntegrationEnabled('podcasts');
  const res = await netGet({ url: buildItunesUrl(term) });
  if (!res.ok) throw new AppError('HTTP', String(res.status));
  try {
    return parseItunes(JSON.parse(res.body));
  } catch {
    throw new AppError('PARSE', 'itunes');
  }
}

let wired = false;

/** Çalma konumunu (iç ses çaların ilerleme olayından) kalıcı depoya yazar; bir kez bağlanır. */
export function wireProgressSaving(): void {
  if (wired) return;
  wired = true;
  audioService.onProgress((source, pos, dur) => {
    void (async () => {
      const cur = sanitizePositions(await readKey<unknown>(POSITIONS_KEY, {}));
      await writeKey(POSITIONS_KEY, savePosition(cur, source.id, pos, dur));
    })().catch(() => undefined);
  });
}
