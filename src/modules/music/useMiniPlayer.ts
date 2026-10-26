import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useInterval, usePageVisible } from '../../shared/lib/hooks';
import { useOverlayActive } from '../../shared/lib/overlay';
import { measure, useNativeBounds, type Bounds } from '../../shared/lib/useNativeBounds';
import { describeError } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { useSettings } from '../settings/settings';
import type { PanelId } from '../window-manager/panels';
import { currentPositionMs, useMediaSession, type MediaAction } from '../system/systemService';
import { musicService } from './musicService';

const MUSIC_VOLUME_KEY = 'alpicim.volume.music';

function loadMusicVolume(): number {
  try {
    const raw = localStorage.getItem(MUSIC_VOLUME_KEY);
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  } catch {
    return 1;
  }
}

function saveMusicVolume(v: number): void {
  try {
    localStorage.setItem(MUSIC_VOLUME_KEY, String(v));
  } catch {
    /* kalıcılık yoksa yalnız bu oturumda */
  }
}

/** Mini oynatıcı durumu: SMTC oturumu, ilerleme, arama ve genişletilmiş sayfa. */
export function useMiniPlayer(musicTabOpen: boolean, onOpenPanel: (p: PanelId) => void) {
  const [settings] = useSettings();
  const visible = usePageVisible();
  const toast = useToast();
  const { session, command } = useMediaSession(settings.performanceMode ? 6000 : 2500, visible, true);
  const playing = session?.status === 'playing';

  // İlerleme çubuğu yalnızca çalarken saniyede bir güncellenir.
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), playing && visible ? 1000 : null);
  const positionMs = session ? currentPositionMs(session, now) : null;
  const durationMs = session?.durationMs && session.durationMs > 0 ? session.durationMs : null;

  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolumeState] = useState(loadMusicVolume);

  // Müzik sekmesi açılınca sayfa kapanır (tek webview, sekme öncelikli).
  useEffect(() => {
    if (musicTabOpen) setSheetOpen(false);
  }, [musicTabOpen]);

  const fail = useCallback((err: unknown) => toast.push('error', describeError(err).description), [toast]);

  const run = useCallback((action: MediaAction) => void command(action).catch(fail), [command, fail]);

  const expand = useCallback(() => {
    if (musicTabOpen) onOpenPanel('music');
    else setSheetOpen(true);
  }, [musicTabOpen, onOpenPanel]);

  const submit = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    try {
      await musicService.search(q);
      setQuery('');
      expand();
    } catch (err) {
      fail(err);
    }
  }, [query, expand, fail]);

  const toggleMute = useCallback(async () => {
    try {
      await musicService.setMuted(!muted);
      setMuted(!muted);
    } catch (err) {
      fail(err);
    }
  }, [muted, fail]);

  const setVolume = useCallback(
    (v: number) => {
      const next = Math.min(1, Math.max(0, v));
      setVolumeState(next);
      saveMusicVolume(next);
      void musicService.setVolume(next).catch(fail);
    },
    [fail],
  );

  // YouTube Music parça değişince kendi sesini geri yükleyebilir: son değeri yeniden uygula.
  const trackKey = session?.own ? `${session.title}|${session.artist}` : '';
  useEffect(() => {
    if (trackKey && loadMusicVolume() < 1) void musicService.setVolume(loadMusicVolume()).catch(() => {});
  }, [trackKey]);

  return {
    volume,
    setVolume,
    session,
    playing,
    positionMs,
    durationMs,
    run,
    query,
    setQuery,
    submit,
    sheetOpen,
    closeSheet: useCallback(() => setSheetOpen(false), []),
    expand,
    muted,
    toggleMute,
  };
}

/**
 * Genişletilmiş sayfada YouTube Music webview'ini `ref` alanının üstüne yerleştirir.
 * Kapanırken webview yalnızca gizlenir (çalmaya devam eder); kapatılmaz/bırakılmaz.
 */
export function useSheetWebview(ref: RefObject<HTMLElement | null>) {
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const last = useRef<Bounds | null>(null);
  const overlay = useOverlayActive();
  const visibleRef = useRef(!overlay);
  visibleRef.current = !overlay;

  useEffect(() => {
    const el = ref.current;
    const b = el ? measure(el) : null;
    if (!b) return;
    last.current = b;
    let alive = true;
    musicService
      .open(b)
      .then(() => {
        if (alive) setOpened(true);
        else void musicService.setBounds(last.current ?? b, false).catch(() => {});
      })
      .catch((err: unknown) => alive && setError(err));
    return () => {
      alive = false;
      void musicService.setBounds(last.current ?? b, false).catch(() => {});
    };
  }, [ref]);

  useNativeBounds(
    ref,
    (b) => {
      last.current = b;
      if (opened) void musicService.setBounds(b, visibleRef.current).catch(() => {});
    },
    [opened, overlay],
  );

  return { opened, error };
}
