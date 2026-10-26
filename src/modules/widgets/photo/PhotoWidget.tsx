import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../../i18n';
import { useInterval } from '../../../shared/lib/hooks';
import { isTauri } from '../../../shared/lib/tauri';
import { useToast } from '../../../shared/ui/Toast';
import { describeError, StateView } from '../../../shared/ui/StateView';
import { isUsable } from '../../integrations/registry';
import { useIntegrations } from '../../integrations/useIntegrations';
import { useSettings } from '../../settings/settings';
import type { WidgetProps } from '../types';
import { localDay, type Photo } from './featured';
import { fetchPhoto, readCachedPhoto } from './photoService';

export type PhotoConfig = Record<string, never>;

export const photoDefaults: PhotoConfig = {};

/** Ayar yok; yalnızca boş nesne. */
export function sanitizePhoto(): PhotoConfig {
  return {};
}

const REFRESH_MS = 30 * 60_000;

/** Günün fotoğrafı (Wikimedia featured). Görsel doğrudan `<img>` ile yüklenir; tıklayınca dosya sayfası açılır. */
export function PhotoWidget({ active }: WidgetProps<PhotoConfig>) {
  const [settings] = useSettings();
  const integrations = useIntegrations();
  const status = integrations.status('wikimedia');
  const usable = isUsable(status);
  const toast = useToast();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    if (!usable) return;
    const today = localDay();
    try {
      const cached = await readCachedPhoto(today);
      setPhoto(cached ? cached.photo : await fetchPhoto(today));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoaded(true);
    }
  }, [usable]);

  useEffect(() => {
    if (usable) void load();
  }, [usable, load]);

  // Gün değişimini ve geçici hataların yeniden denenmesini yakalamak için seyrek kontrol.
  useInterval(() => void load(), active && usable ? REFRESH_MS * (settings.performanceMode ? 2 : 1) : null);

  const open = async () => {
    if (!photo) return;
    try {
      if (isTauri()) await openUrl(photo.filePage);
      else window.open(photo.filePage, '_blank', 'noopener');
    } catch {
      toast.push('error', t('photo.openFailed'));
    }
  };

  if (status === null) return <StateView compact kind="loading" title={t('common.loading')} />;
  if (status === 'off') {
    return <StateView compact kind="setup" title={t('errors.disabledTitle')} description={t('errors.disabledBody')} />;
  }
  if (!loaded) return <StateView compact kind="loading" title={t('common.loading')} />;
  if (error) {
    return <StateView compact kind="error" title={t('photo.failed')} description={describeError(error).description} />;
  }
  if (!photo) return <StateView compact kind="empty" title={t('photo.empty')} />;

  const artist = photo.artist || t('photo.unknownArtist');
  return (
    <button
      type="button"
      onClick={() => void open()}
      title={t('photo.open')}
      className="group relative h-full w-full overflow-hidden text-left"
    >
      <img
        src={photo.thumbnail}
        alt={photo.description || t('widgets.photo.title')}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
      <div
        className="absolute inset-x-0 bottom-0 px-3 pt-10 pb-2.5 text-white"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0))' }}
      >
        {photo.description && <p className="line-clamp-2 text-sm leading-snug">{photo.description}</p>}
        <p className="mt-1 truncate text-xs text-white/75">{t('photo.credit', { artist })}</p>
      </div>
    </button>
  );
}
