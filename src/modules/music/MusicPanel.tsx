import { openUrl } from '@tauri-apps/plugin-opener';
import { ArrowLeft, ExternalLink, Home, Info, Music2, RotateCw, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { useOverlayActive } from '../../shared/lib/overlay';
import { isTauri } from '../../shared/lib/tauri';
import { measure, useNativeBounds } from '../../shared/lib/useNativeBounds';
import { Button, IconButton } from '../../shared/ui/primitives';
import { describeError, StateView } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { useSettings } from '../settings/settings';
import { MediaControls } from '../system/MediaControls';
import { MUSIC_HOME, musicService } from './musicService';

/**
 * YouTube Music paneli: resmî web arayüzü yerel bir WebView2 alt penceresinde açılır.
 * Oynatma düğmeleri Windows medya oturumu (SMTC) üzerinden çalışır; sayfaya betik enjekte edilmez.
 */
export function MusicPanel() {
  const toast = useToast();
  const [settings] = useSettings();
  const contentRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const overlay = useOverlayActive();
  const visibleRef = useRef(!overlay);
  visibleRef.current = !overlay;
  const keepRef = useRef(settings.musicKeepPlaying);
  keepRef.current = settings.musicKeepPlaying;

  const open = useCallback(async () => {
    const el = contentRef.current;
    const b = el ? measure(el) : null;
    if (!b) return;
    setError(null);
    try {
      await musicService.open(b);
      setOpened(true);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    void open();
    const off = musicService.onEvent((e) => {
      if (e.loading !== null) setLoading(e.loading);
    });
    return () => {
      off();
      void musicService.release(keepRef.current).catch(() => {});
    };
  }, [open]);

  useNativeBounds(
    contentRef,
    (b) => {
      if (opened) void musicService.setBounds(b, visibleRef.current).catch(() => {});
    },
    [opened, overlay],
  );

  const toggleMute = async () => {
    try {
      await musicService.setMuted(!muted);
      setMuted(!muted);
    } catch (err) {
      toast.push('error', describeError(err).description);
    }
  };

  const openExternal = async () => {
    try {
      await openUrl(MUSIC_HOME);
    } catch {
      toast.push('error', t('news.openFailed'));
    }
  };

  if (!isTauri()) {
    return <StateView kind="desktop" title={t('errors.desktopTitle')} description={t('errors.desktopBody')} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 py-2">
        <IconButton icon={Home} label={t('music.home')} disabled={!opened} onClick={() => void musicService.action('home')} />
        <IconButton icon={ArrowLeft} label={t('browser.back')} disabled={!opened} onClick={() => void musicService.action('back')} />
        <IconButton icon={RotateCw} spin={loading && opened} label={t('browser.reload')} disabled={!opened} onClick={() => void musicService.action('reload')} />
        <div className="mx-1 h-5 w-px bg-stroke-strong" />
        <MediaControls compact preferOwn />
        <div className="ml-auto flex items-center gap-1.5">
          <IconButton
            icon={muted ? VolumeX : Volume2}
            active={muted}
            label={muted ? t('music.unmute') : t('music.mute')}
            disabled={!opened}
            onClick={() => void toggleMute()}
          />
          <IconButton icon={ExternalLink} label={t('music.openExternal')} onClick={() => void openExternal()} />
        </div>
      </div>
      {showHint && (
        <div className="flex shrink-0 items-start gap-2 border-y border-stroke bg-layer px-4 py-2 text-sm text-fg-2">
          <Info size={15} className="mt-0.5 shrink-0 text-accent" />
          <p className="flex-1">{t('music.loginHint')}</p>
          <button type="button" className="text-accent hover:underline" onClick={() => setShowHint(false)}>
            {t('common.close')}
          </button>
        </div>
      )}
      {/* Yerel webview bu alanın üstüne yerleştirilir. */}
      <div ref={contentRef} className="relative min-h-0 flex-1 bg-card">
        {error ? (
          <StateView
            kind="error"
            title={t('music.openFailed')}
            description={describeError(error).description}
            action={
              <div className="flex gap-2">
                <Button onClick={() => void open()}>{t('common.retry')}</Button>
                <Button variant="primary" onClick={() => void openExternal()}>
                  {t('music.openExternal')}
                </Button>
              </div>
            }
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-fg-3">
            <Music2 size={28} strokeWidth={1.5} />
            <p className="text-sm">{overlay ? t('music.hiddenWhileMenu') : t('common.loading')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
