import { ExternalLink, Maximize2, Music2, Pause, Play, Search, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n';
import { setOverlay } from '../../shared/lib/overlay';
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
        <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
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
              {artist && <span className="text-fg-2"> · {artist}</span>}
            </p>
            {positionMs !== null && (
              <div className="flex items-center gap-2 text-xs leading-4 text-fg-3">
                <span className="tabular">{formatTrackTime(positionMs)}</span>
                <div
                  className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-control"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={durationMs ?? undefined}
                  aria-valuenow={Math.round(positionMs)}
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <span className="tabular">{durationMs ? formatTrackTime(durationMs) : '--:--'}</span>
              </div>
            )}
          </>
        ) : (
          <p className="truncate text-sm text-fg-3">{t('mini.none')}</p>
        )}
      </div>

      <VolumeControl
        volume={internal ? audio.volume : p.volume}
        muted={internal ? audio.muted : p.muted}
        disabled={!internal && !session?.own}
        onVolume={(v) => (internal ? audioService.setVolume(v) : p.setVolume(v))}
        onMute={() => (internal ? audioService.setMuted(!audio.muted) : void p.toggleMute())}
      />
      <IconButton icon={Maximize2} label={t('mini.expand')} onClick={p.expand} />

      {p.sheetOpen && !musicTabOpen && <MusicSheet onClose={p.closeSheet} onOpenTab={() => onOpenPanel('music')} />}
    </div>
  );
}

const STEP = 0.05;

/** Hoparlör düğmesi: tıklayınca ses kaydırıcısı + sessize alma; düğmenin üstünde fare tekerleği ±5. */
function VolumeControl({
  volume,
  muted,
  disabled,
  onVolume,
  onMute,
}: {
  volume: number;
  muted: boolean;
  disabled: boolean;
  onVolume: (v: number) => void;
  onMute: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const key = useId();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pct = Math.round(volume * 100);
  const Icon = muted || pct === 0 ? VolumeX : Volume2;

  useEffect(() => {
    if (!open) return;
    const r = wrap.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.max(8, Math.min(r.right - 224, window.innerWidth - 232)), y: window.innerHeight - r.top + 4 });
    setOverlay(key, true);
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      setOverlay(key, false);
    };
  }, [open, key]);

  // Tekerlek dinleyicisi pasif olmamalı (sayfa kaymasını engellemek için).
  useEffect(() => {
    const el = wrap.current;
    if (!el || disabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = Math.round((volume + (e.deltaY < 0 ? STEP : -STEP)) * 100) / 100;
      onVolume(Math.min(1, Math.max(0, next)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [volume, disabled, onVolume]);

  return (
    <span ref={wrap} className="inline-flex">
      <IconButton
        icon={Icon}
        active={muted}
        label={t('mini.volume', { percent: pct })}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={t('mini.volumeTitle')}
            style={{ left: pos.x, bottom: pos.y, width: 224 }}
            className="fixed z-[1000] flex items-center gap-2 rounded-lg bg-card p-2 shadow-[inset_0_0_0_1px_var(--stroke-strong),var(--shadow-pop)]"
          >
            <IconButton icon={Icon} active={muted} label={muted ? t('music.unmute') : t('music.mute')} onClick={onMute} />
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={pct}
              aria-label={t('mini.volumeTitle')}
              onChange={(e) => onVolume(Number(e.target.value) / 100)}
              className="min-w-0 flex-1 accent-[var(--accent)]"
            />
            <span className="tabular w-9 shrink-0 text-right text-xs text-fg-2">{pct}%</span>
          </div>,
          document.body,
        )}
    </span>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('mini.sheetTitle')}
        className="flex h-[70%] w-[70%] min-w-[480px] flex-col overflow-hidden rounded-xl bg-card ring-1 ring-stroke-strong shadow-[var(--shadow-pop)]"
      >
        <div className="flex h-[52px] shrink-0 items-center gap-2 px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Music2 size={18} aria-hidden />
          </span>
          <h2 className="flex-1 truncate font-display text-lg font-semibold">{t('mini.sheetTitle')}</h2>
          <Button icon={ExternalLink} onClick={onOpenTab}>
            {t('mini.openInTab')}
          </Button>
          <IconButton icon={X} label={t('common.close')} onClick={onClose} />
        </div>
        <div ref={contentRef} className="relative min-h-0 flex-1 bg-layer">
          {error ? (
            <p role="alert" className="p-4 text-sm text-down">
              {describeError(error).description}
            </p>
          ) : (
            !opened && <p className="p-4 text-sm text-fg-3">{t('common.loading')}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
