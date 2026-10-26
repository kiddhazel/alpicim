import { Dices, Gamepad2, Play, RefreshCw, Search, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../../i18n';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { Badge, Button, cx, IconButton, Segmented, TextInput } from '../../shared/ui/primitives';
import { describeError, StateView } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { useIntegrationStates } from '../integrations/useIntegrations';
import {
  DEFAULT_LIBRARY,
  filterGames,
  LIBRARY_KEY,
  markPlayed,
  pickRandom,
  sanitizeLibrary,
  steamHeaderUrl,
  toggleFavorite,
  type LibraryFilter,
  type LibraryGame,
  type LibraryState,
} from './library';
import { libraryService } from './libraryService';

/** Oyun kütüphanesi: Steam / Epic / Riot taraması, favoriler, son oynananlar, rastgele oyun. */
export function LibraryPanel() {
  const toast = useToast();
  const [games, setGames] = useState<LibraryGame[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [scanning, setScanning] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [state, setState] = usePersistentState<LibraryState>(LIBRARY_KEY, DEFAULT_LIBRARY, sanitizeLibrary);
  const [integrations] = useIntegrationStates();
  const covers = integrations.steamcdn;

  const load = useCallback(async (rescan: boolean) => {
    setScanning(true);
    try {
      setGames(await (rescan ? libraryService.scan() : libraryService.list()));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const visible = useMemo(() => filterGames(games ?? [], state, query, filter), [games, state, query, filter]);

  const launch = useCallback(
    async (game: LibraryGame) => {
      try {
        await libraryService.launch(game.id);
        setState((s) => markPlayed(s, game.id, Date.now()));
        toast.push('success', t('library.launched', { name: game.name }));
      } catch (err) {
        toast.push('error', describeError(err).description);
      }
    },
    [setState, toast],
  );

  const surprise = () => {
    const pool = visible.length > 0 ? visible : (games ?? []);
    const pick = pickRandom(pool, Math.random());
    if (pick) void launch(pick);
  };

  if (error) {
    const d = describeError(error);
    return (
      <StateView
        kind={d.kind}
        title={d.title}
        description={d.description}
        action={d.kind === 'desktop' ? undefined : <Button onClick={() => void load(true)}>{t('library.rescan')}</Button>}
      />
    );
  }
  if (!games) return <StateView kind="loading" title={t('library.scanning')} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-stroke px-4 py-3">
        <div className="relative min-w-40 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-3" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('library.search')}
            aria-label={t('library.search')}
            className="w-full pl-9"
          />
        </div>
        <Segmented<LibraryFilter>
          label={t('library.filter')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('library.filterAll') },
            { value: 'favorites', label: t('library.filterFavorites'), icon: Star },
            { value: 'recent', label: t('library.filterRecent') },
          ]}
        />
        <Button icon={Dices} onClick={surprise} disabled={games.length === 0}>
          {t('library.random')}
        </Button>
        <IconButton icon={RefreshCw} label={t('library.rescan')} spin={scanning} disabled={scanning} onClick={() => void load(true)} />
      </div>

      {games.length === 0 ? (
        <StateView kind="empty" title={t('library.emptyTitle')} description={t('library.emptyBody')} />
      ) : visible.length === 0 ? (
        <StateView kind="empty" title={t('library.noMatch')} />
      ) : (
        <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 overflow-y-auto p-4">
          {visible.map((g) => (
            <GameCard
              key={g.id}
              game={g}
              covers={covers}
              favorite={state.favorites.includes(g.id)}
              lastPlayed={state.lastPlayed[g.id]}
              onLaunch={() => void launch(g)}
              onFavorite={() => setState((s) => toggleFavorite(s, g.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function GameCard({
  game,
  covers,
  favorite,
  lastPlayed,
  onLaunch,
  onFavorite,
}: {
  game: LibraryGame;
  covers: boolean;
  favorite: boolean;
  lastPlayed: number | undefined;
  onLaunch: () => void;
  onFavorite: () => void;
}) {
  const [icon, setIcon] = useState<string | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = game.store === 'steam' && game.appId !== null && covers && !coverFailed ? steamHeaderUrl(game.appId) : null;

  useEffect(() => {
    if (!game.hasIcon) return;
    let alive = true;
    void libraryService
      .icon(game.id)
      .then((url) => alive && setIcon(url))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [game.id, game.hasIcon]);

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-xl border border-stroke bg-card">
      <button type="button" onClick={onLaunch} title={t('library.play', { name: game.name })} className="flex flex-1 flex-col text-left">
        <div className="relative flex aspect-[460/215] w-full items-center justify-center bg-layer">
          {cover ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              draggable={false}
              onError={() => setCoverFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : icon ? (
            <img src={icon} alt="" draggable={false} className="h-14 w-14 object-contain" />
          ) : (
            <Gamepad2 size={30} strokeWidth={1.5} className="text-fg-3" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Play size={28} className="text-white" fill="currentColor" />
          </span>
        </div>
        <div className="flex flex-col gap-1 px-3 py-2.5">
          <span className="truncate text-sm font-medium text-fg">{game.name}</span>
          <span className="flex items-center gap-2">
            <Badge tone="neutral">{t(`library.store.${game.store}`)}</Badge>
            {lastPlayed !== undefined && (
              <span className="truncate text-xs text-fg-3">{new Date(lastPlayed).toLocaleDateString('tr-TR')}</span>
            )}
          </span>
        </div>
      </button>
      <IconButton
        icon={Star}
        size="sm"
        label={favorite ? t('library.unfavorite') : t('library.favorite')}
        active={favorite}
        onClick={onFavorite}
        className={cx('absolute top-2 right-2 bg-black/40', favorite ? '!text-warn' : '!text-white')}
      />
    </li>
  );
}
