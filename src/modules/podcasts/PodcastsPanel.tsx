import { ArrowLeft, Pause, Play, Plus, Rewind, FastForward, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../i18n';
import { formatDateTime } from '../../shared/lib/time';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { Button, cx, IconButton, TextInput } from '../../shared/ui/primitives';
import { describeError, SkeletonRows, StateView } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { formatTrackTime } from '../system/systemService';
import type { PodcastFeed } from '../news/rss';
import { audioService, useAudio } from '../radio/audioService';
import {
  addSub,
  nextRate,
  normalizeFeedUrl,
  preferHttps,
  removeSub,
  resumeAt,
  sanitizePositions,
  sanitizeSubs,
  SUGGESTED_TERMS,
  type PodcastHit,
  type PodcastSub,
} from './podcasts';
import { fetchPodcast, POSITIONS_KEY, searchPodcasts, wireProgressSaving } from './podcastService';

export function PodcastsPanel() {
  const [subs, setSubs] = usePersistentState<PodcastSub[]>('podcasts.subs', [], sanitizeSubs);
  const [positions] = usePersistentState(POSITIONS_KEY, {}, sanitizePositions);
  const [openId, setOpenId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [hits, setHits] = useState<PodcastHit[] | null>(null);
  const [searchError, setSearchError] = useState<unknown>(null);
  const [searching, setSearching] = useState(false);
  const toast = useToast();
  const audio = useAudio();

  useEffect(() => wireProgressSaving(), []);

  const open = subs.find((s) => s.id === openId) ?? null;

  const subscribe = (url: string, title: string, image: string) => {
    setSubs((s) => addSub(s, url, title, image));
    toast.push('success', t('podcasts.subscribed', { title }));
  };

  const submit = async () => {
    const raw = input.trim();
    if (!raw) return;
    const url = normalizeFeedUrl(raw);
    if (url) {
      try {
        const feed = await fetchPodcast(url);
        subscribe(url, feed.title || url, feed.image);
        setInput('');
        setHits(null);
      } catch (err) {
        toast.push('error', describeError(err).description);
      }
      return;
    }
    await runSearch(raw);
  };

  const runSearch = async (term: string) => {
    setSearching(true);
    setSearchError(null);
    try {
      setHits(await searchPodcasts(term));
    } catch (err) {
      setSearchError(err);
    } finally {
      setSearching(false);
    }
  };

  if (open) {
    return (
      <EpisodeList
        sub={open}
        positions={positions}
        onBack={() => setOpenId(null)}
        onRemove={() => {
          setSubs((s) => removeSub(s, open.id));
          setOpenId(null);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-3">
        <form
          className="relative flex-1"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <TextInput
            className="w-full pl-9"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('podcasts.addPlaceholder')}
            aria-label={t('podcasts.add')}
          />
        </form>
        <Button variant="primary" icon={Plus} onClick={() => void submit()}>
          {t('podcasts.add')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {searching ? (
          <SkeletonRows rows={5} />
        ) : searchError ? (
          <StateView kind={describeError(searchError).kind} title={describeError(searchError).title} description={describeError(searchError).description} />
        ) : hits ? (
          <>
            <button type="button" className="mb-2 text-sm text-accent" onClick={() => setHits(null)}>
              {t('podcasts.backToList')}
            </button>
            {hits.length === 0 && <StateView kind="empty" title={t('podcasts.noResults')} />}
            <ul className="flex flex-col gap-1">
              {hits.map((h) => {
                const done = subs.some((s) => s.url === h.feedUrl);
                return (
                  <li key={h.feedUrl} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                    <Cover src={h.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{h.title}</p>
                      <p className="truncate text-xs text-faint">{h.author}</p>
                    </div>
                    <Button disabled={done} onClick={() => subscribe(h.feedUrl, h.title, h.image)}>
                      {done ? t('podcasts.subscribedShort') : t('podcasts.subscribe')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : subs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted">{t('podcasts.empty')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_TERMS.map((term) => (
                <Button key={term} onClick={() => void runSearch(term)}>
                  {term}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {subs.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(s.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <Cover src={s.image} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {audio.source?.kind === 'podcast' && <PodcastBar />}
    </div>
  );
}

function Cover({ src }: { src: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg bg-surface-3 object-cover" />
  ) : (
    <span className="h-10 w-10 shrink-0 rounded-lg bg-surface-3" aria-hidden />
  );
}

function EpisodeList({
  sub,
  positions,
  onBack,
  onRemove,
}: {
  sub: PodcastSub;
  positions: Record<string, number>;
  onBack: () => void;
  onRemove: () => void;
}) {
  const [feed, setFeed] = useState<PodcastFeed | null>(null);
  const [error, setError] = useState<unknown>(null);
  const audio = useAudio();

  const load = useCallback(() => {
    setFeed(null);
    setError(null);
    fetchPodcast(sub.url).then(setFeed, setError);
  }, [sub.url]);
  useEffect(load, [load]);

  const playingId = audio.source?.kind === 'podcast' ? audio.source.id : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-3">
        <IconButton icon={ArrowLeft} label={t('podcasts.backToList')} onClick={onBack} />
        <h2 className="min-w-0 flex-1 truncate text-md font-semibold">{sub.title}</h2>
        <IconButton icon={Trash2} tone="danger" label={t('podcasts.unsubscribe')} onClick={onRemove} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {error ? (
          <StateView
            kind={describeError(error).kind}
            title={describeError(error).title}
            description={describeError(error).description}
            action={<Button onClick={load}>{t('common.retry')}</Button>}
          />
        ) : !feed ? (
          <SkeletonRows rows={6} />
        ) : feed.episodes.length === 0 ? (
          <StateView kind="empty" title={t('podcasts.noEpisodes')} />
        ) : (
          <ul className="flex flex-col gap-1">
            {feed.episodes.map((ep) => {
              const current = playingId === ep.id;
              const pos = resumeAt(positions, ep.id);
              return (
                <li key={ep.id} className={cx('flex items-center gap-3 rounded-xl px-2 py-1.5', current ? 'bg-accent-soft' : 'hover:bg-surface-2')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={ep.title}>
                      {ep.title}
                    </p>
                    <p className="truncate text-xs text-faint">
                      {[
                        ep.publishedAt ? formatDateTime(ep.publishedAt) : '',
                        ep.durationSec ? formatTrackTime(ep.durationSec * 1000) : '',
                        pos > 0 ? t('podcasts.resumeAt', { time: formatTrackTime(pos * 1000) }) : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <IconButton
                    icon={current && audio.playing ? Pause : Play}
                    label={current && audio.playing ? t('media.pause') : t('media.play')}
                    onClick={() =>
                      void audioService.play(
                        { kind: 'podcast', id: ep.id, title: ep.title, subtitle: feed.title || sub.title, url: preferHttps(ep.audioUrl) },
                        pos,
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {audio.source?.kind === 'podcast' && <PodcastBar />}
    </div>
  );
}

function PodcastBar() {
  const a = useAudio();
  if (!a.source) return null;
  const pct = a.durationSec ? Math.min(100, (a.positionSec / a.durationSec) * 100) : 0;
  return (
    <div className="glass flex flex-col gap-1 px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{a.source.title}</p>
          <p className="truncate text-xs text-faint">{a.error ? t('podcasts.playError') : a.source.subtitle}</p>
        </div>
        <IconButton icon={Rewind} label={t('podcasts.back10')} onClick={() => audioService.skip(-10)} />
        <IconButton icon={a.playing ? Pause : Play} label={a.playing ? t('media.pause') : t('media.play')} onClick={() => audioService.toggle()} />
        <IconButton icon={FastForward} label={t('podcasts.fwd30')} onClick={() => audioService.skip(30)} />
        <Button onClick={() => audioService.setRate(nextRate(a.rate))} aria-label={t('podcasts.rate')}>
          {a.rate}x
        </Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-faint">
        <span className="tabular">{formatTrackTime(a.positionSec * 1000)}</span>
        <input
          type="range"
          className="h-1 min-w-0 flex-1 accent-[var(--accent)]"
          min={0}
          max={a.durationSec ?? 0}
          step={1}
          value={Math.min(a.positionSec, a.durationSec ?? 0)}
          disabled={!a.durationSec}
          aria-label={t('podcasts.seek')}
          onChange={(e) => audioService.seek(Number(e.target.value))}
          style={{ backgroundSize: `${pct}% 100%` }}
        />
        <span className="tabular">{a.durationSec ? formatTrackTime(a.durationSec * 1000) : '--:--'}</span>
      </div>
    </div>
  );
}
