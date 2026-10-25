import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../../i18n';
import { onKeyChanged } from '../../../shared/lib/store';
import { isTauri } from '../../../shared/lib/tauri';
import { describeError, StateView } from '../../../shared/ui/StateView';
import { useToast } from '../../../shared/ui/Toast';
import { AppIcon } from '../../launcher/AppIcon';
import { launcherIcon } from '../../launcher/icons';
import { LAUNCHER_CHANGED_KEY, launcherService, type LaunchItem } from '../../launcher/launcherService';
import { useSettings } from '../../settings/settings';
import { bool, num, obj, type WidgetProps, type WidgetSettingsProps } from '../types';
import { Toggle } from '../../../shared/ui/primitives';

export interface FavoritesConfig {
  /** Yalnızca favoriler mi, yoksa favori yoksa ilk öğeler mi? */
  onlyFavorites: boolean;
  limit: number;
}

export const favoritesDefaults: FavoritesConfig = { onlyFavorites: false, limit: 12 };

export function sanitizeFavorites(raw: unknown): FavoritesConfig {
  const r = obj(raw);
  return { onlyFavorites: bool(r.onlyFavorites, false), limit: num(r.limit, 2, 40, 12) };
}

/** Favori uygulama kısayolları; tıklanınca açar ya da (ayara göre) açık penceresine odaklanır. */
export function FavoritesWidget({ config }: WidgetProps<FavoritesConfig>) {
  const toast = useToast();
  const [settings] = useSettings();
  const [items, setItems] = useState<LaunchItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    const pull = () =>
      launcherService
        .list()
        .then((list) => alive && setItems(list))
        .catch((err: unknown) => alive && setError(err));
    void pull();
    const off = onKeyChanged(LAUNCHER_CHANGED_KEY, () => void pull());
    return () => {
      alive = false;
      off();
    };
  }, []);

  if (!isTauri()) return <StateView compact kind="desktop" title={t('errors.desktopTitle')} />;
  if (error) return <StateView compact kind="error" title={t('widgets.favorites.failed')} description={describeError(error).description} />;
  if (!items) return <StateView compact kind="loading" title={t('common.loading')} />;

  const favorites = items.filter((i) => i.favorite);
  const shown = (favorites.length > 0 || config.onlyFavorites ? favorites : items).slice(0, config.limit);
  if (shown.length === 0) {
    return <StateView compact kind="empty" title={t('widgets.favorites.empty')} description={t('widgets.favorites.emptyBody')} />;
  }

  const launch = async (item: LaunchItem) => {
    try {
      const result = await launcherService.launch(item.id, settings.launcherFocusExisting);
      if (result === 'focused') toast.push('info', t('widgets.favorites.focused', { name: item.name }));
    } catch (err) {
      toast.push('error', describeError(err).description);
    }
  };

  return (
    <ul className="grid h-full auto-rows-min grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 overflow-y-auto p-3 pt-1">
      {shown.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            title={item.path}
            disabled={!item.exists}
            onClick={() => void launch(item)}
            className="flex h-[88px] w-full flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2 transition-colors hover:bg-surface-3 disabled:opacity-40"
          >
            <AppIcon path={item.path} fallback={launcherIcon(item.icon)} size={32} className="text-accent" />
            <span className="w-full truncate text-center text-xs">{item.name}</span>
          </button>
        </li>
      ))}
      {favorites.length === 0 && !config.onlyFavorites && (
        <li className="col-span-full flex items-center justify-center gap-1 text-xs text-faint">
          <Star size={12} /> {t('widgets.favorites.hint')}
        </li>
      )}
    </ul>
  );
}

export function FavoritesSettings({ config, setConfig }: WidgetSettingsProps<FavoritesConfig>) {
  return (
    <label className="flex items-center justify-between text-sm">
      {t('widgets.favorites.onlyFavorites')}
      <Toggle checked={config.onlyFavorites} label={t('widgets.favorites.onlyFavorites')} onChange={(v) => setConfig({ onlyFavorites: v })} />
    </label>
  );
}
