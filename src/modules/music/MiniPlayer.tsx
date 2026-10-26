import { ExternalLink, Maximize2, Music2, Pause, Play, Search, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n';
import { Button, IconButton, TextInput } from '../../shared/ui/primitives';
import { describeError } from '../../shared/ui/StateView';
import { formatTrackTime } from '../system/systemService';
import type { PanelId } from '../window-manager/panels';
import { audioService, showInternalAudio, useAudio } from '../radio/audioService';
import { useMiniPlayer, useSheetWebview } from './useMiniPlayer';

/** Alt çubuktaki YouTube Music mini oynatıcısı: arama, SMTC denetimleri, ilerleme ve genişletilmiş sayfa. */
export function MiniPlayer({ onOpenPanel, musicTabOpen }: { onOpenPanel: (p: PanelId) => void; musicTabOpen: boolean }) {
  const p = useMiniPlayer(musicTabOpen, onOpenPanel);
  const audio = useAudio();
  const internal = showInternalAudio(audio.source !== null, audio.playing, p.playing);
  const { session } = p;
  const hasTitle = internal ? Boolean(audio.source) : Boolean(session && session.title);
  const positionMs = internal ? (audio.durationSec ? audio.positionSec * 1000 : null) : p.positionMs;
  const durationMs = internal ? (audio.durationSec ? audio.durationSec * 1000 : null) : p.durationMs;
  const title = internal ? (audio.source?.title ?? '') : (session?.title ?? '');
  const artist = internal ? (audio.source?.subtitle ?? '') : (session?.artist ?? '');
  const pct = positionMs !== null && durationMs ? Math.min(100, (positionMs / durationMs) * 100) : 0;

  return (
    <div className="flex h-full w-[560px] max-w-full shrink-0 items-center gap-2">
      <form
        className="relative w-36 shrink-0"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void p.submit();
        }}
      >
        <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <TextInput
          type="search"
          className="w-full pl-9"
          value={p.query}
          onChange={(e) => p.setQuery(e.target.value)}
          placeholder={t('mini.searchPlaceholder')}
          aria-label={t('mini.search')}
        />
      </form>

      <div className="flex shrink-0 items-center">
        <IconButton icon={SkipBack} label={t('media.previous')} disabled={internal ? audio.durationSec === null : !session?.canPrevious} onClick={() => (internal ? audioService.skip(-10) : p.run('previous'))} />
        <IconButton
          icon={(internal ? audio.playing : p.playing) ? Pause : Play}
          label={(internal ? audio.playing : p.playing) ? t('media.pause') : t('media.play')}
          disabled={internal ? false : !session?.canPlayPause}
          onClick={() => (internal ? audioService.toggle() : p.run('playPause'))}
        />
        <IconButton icon={SkipForward} label={t('media.next')} disabled={internal ? audio.durationSec === null : !session?.canNext} onClick={() => (internal ? audioService.skip(30) : p.run('next'))} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {hasTitle && (internal ? audio.source : session) ? (
          <>
            <p className="truncate text-sm leading-5" title={`${title} — ${artist}`}>
              <span className="font-medium text-fg">{title}</span>
              {artist && <span className="text-muted"> · {artist}</span>}
            </p>
            {positionMs !== null && (
              <div className="flex items-center gap-2 text-xs leading-4 text-faint">
                <span className="tabular">{formatTrackTime(positionMs)}</span>
                <div
                  className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={durationMs ?? undefined}
                  aria-valuenow={Math.round(positionMs)}
                >
                  <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${pct}%` }} />
                </div>
                <span className="tabular">{durationMs ? formatTrackTime(durationMs) : '--:--'}</span>
              </div>
            )}
          </>
        ) : (
          <p className="truncate text-sm text-faint">{t('mini.none')}</p>
        )}
      </div>

      <IconButton
        icon={p.muted ? VolumeX : Volume2}
        active={p.muted}
        label={p.muted ? t('music.unmute') : t('music.mute')}
        disabled={internal || !session?.own}
        onClick={() => void p.toggleMute()}
      />
      <IconButton icon={Maximize2} label={t('mini.expand')} onClick={p.expand} />

      {p.sheetOpen && !musicTabOpen && <MusicSheet onClose={p.closeSheet} onOpenTab={() => onOpenPanel('music')} />}
    </div>
  );
}

/** Ortalanmış cam sayfa; YouTube Music webview'i içerik alanının üstüne yerleştirilir. */
function MusicSheet({ onClose, onOpenTab }: { onClose: () => void; onOpenTab: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { opened, error } = useSheetWebview(contentRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal: alt çubuğun backdrop-filter'ı `fixed` konumu kendi kutusuna bağlamasın.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('mini.sheetTitle')}
        className="glass flex h-[70%] w-[70%] min-w-[480px] flex-col overflow-hidden rounded-3xl"
      >
        <div className="flex h-[52px] shrink-0 items-center gap-2 px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Music2 size={18} aria-hidden />
          </span>
          <h2 className="flex-1 truncate text-md font-semibold tracking-tight">{t('mini.sheetTitle')}</h2>
          <Button icon={ExternalLink} onClick={onOpenTab}>
            {t('mini.openInTab')}
          </Button>
          <IconButton icon={X} label={t('common.close')} onClick={onClose} />
        </div>
        <div ref={contentRef} className="relative min-h-0 flex-1 bg-surface-2">
          {error ? (
            <p role="alert" className="p-4 text-sm text-down">
              {describeError(error).description}
            </p>
          ) : (
            !opened && <p className="p-4 text-sm text-faint">{t('common.loading')}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
