import { Heart, Pause, Play, Radio as RadioIcon, Search, Square } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../i18n';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { Badge, Button, Card, IconButton, List, ListItem, Segmented, TextInput } from '../../shared/ui/primitives';
import { describeError, SkeletonRows, StateView } from '../../shared/ui/StateView';
import { audioService, useAudio } from './audioService';
import { sanitizeFavorites, toggleFavorite, type RadioStation } from './radio';
import { loadCurated, searchStations } from './radioService';

type Tab = 'curated' | 'popular' | 'favorites';

interface Loaded {
  stations: RadioStation[];
  skippedHttp: number;
}

export function RadioPanel() {
  const [tab, setTab] = useState<Tab>('curated');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('');
  const [favs, setFavs] = usePersistentState<RadioStation[]>('radio.favorites', [], sanitizeFavorites);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<unknown>(null);
  const audio = useAudio();

  const load = useCallback(async (mode: Tab | 'search', q: string) => {
    if (mode === 'favorites') {
      setData(null);
      return;
    }
    setData(null);
    setError(null);
    try {
      if (mode === 'curated') setData({ stations: await loadCurated(), skippedHttp: 0 });
      else if (mode === 'popular') setData(await searchStations({ limit: 60 }));
      else setData(await searchStations({ name: q, limit: 60 }));
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    void load(active ? 'search' : tab, active);
  }, [tab, active, load]);

  const stations = tab === 'favorites' && !active ? favs : (data?.stations ?? []);
  const loading = !error && data === null && !(tab === 'favorites' && !active);
  const playingId = audio.source?.kind === 'radio' ? audio.source.id : null;

  const play = (s: RadioStation) =>
    void audioService.play({ kind: 'radio', id: s.id, title: s.name, subtitle: t('radio.live'), url: s.url });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <form
          className="relative min-w-[160px] flex-1"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setActive(query.trim());
          }}
        >
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <TextInput
            type="search"
            className="w-full pl-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value.trim()) setActive('');
            }}
            placeholder={t('radio.searchPlaceholder')}
            aria-label={t('radio.search')}
          />
        </form>
        <Segmented<Tab>
          label={t('radio.tabs')}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setQuery('');
            setActive('');
          }}
          options={[
            { value: 'curated', label: t('radio.curated') },
            { value: 'popular', label: t('radio.popular') },
            { value: 'favorites', label: t('radio.favorites') },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <SkeletonRows rows={8} />
        ) : error ? (
          <StateView
            kind={describeError(error).kind}
            title={describeError(error).title}
            description={describeError(error).description}
            action={<Button onClick={() => void load(active ? 'search' : tab, active)}>{t('common.retry')}</Button>}
          />
        ) : stations.length === 0 ? (
          <StateView kind="empty" title={tab === 'favorites' && !active ? t('radio.noFavorites') : t('radio.noResults')} />
        ) : (
          <Card className="p-1">
            <List>
              {stations.map((s) => {
                const current = playingId === s.id;
                const fav = favs.some((f) => f.id === s.id);
                return (
                  <ListItem
                    key={s.id}
                    selected={current}
                    leading={
                      s.favicon ? (
                        <img src={s.favicon} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded-md bg-control object-contain" />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-control text-fg-3">
                          <RadioIcon size={16} aria-hidden />
                        </span>
                      )
                    }
                    title={s.name}
                    subtitle={[s.codec, s.bitrate ? `${s.bitrate} kbps` : '', s.tags.split(',').slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
                    trailing={
                      <span className="flex items-center gap-1">
                        {current && audio.error && <Badge tone="down">{t('radio.playError')}</Badge>}
                        <IconButton
                          icon={Heart}
                          active={fav}
                          label={fav ? t('radio.removeFavorite') : t('radio.addFavorite')}
                          onClick={() => setFavs((f) => toggleFavorite(f, s))}
                        />
                        <IconButton
                          icon={current && audio.playing ? Pause : Play}
                          label={current && audio.playing ? t('media.pause') : t('media.play')}
                          onClick={() => play(s)}
                        />
                      </span>
                    }
                  />
                );
              })}
            </List>
          </Card>
        )}
        {data && data.skippedHttp > 0 && <p className="pt-2 text-xs text-fg-3">{t('radio.skippedHttp', { n: data.skippedHttp })}</p>}
      </div>

      {audio.source?.kind === 'radio' && (
        <Card className="m-3 mt-0 flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{audio.source.title}</p>
            <p className="truncate text-xs text-fg-3">{audio.loading ? t('common.loading') : audio.source.subtitle}</p>
          </div>
          <IconButton icon={Square} label={t('radio.stop')} onClick={() => audioService.stop()} />
        </Card>
      )}
    </div>
  );
}
