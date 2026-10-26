import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';
import { useNow } from '../../shared/lib/hooks';
import { setOverlay } from '../../shared/lib/overlay';
import { onKeyChanged, readKey } from '../../shared/lib/store';
import { isTauri } from '../../shared/lib/tauri';
import { track } from '../../shared/lib/track';
import { BOND_KEY, DEFAULT_BOND, sanitizeBond, type Bond } from '../laila/bond';
import { frameUrls, SPRITE_H, SPRITE_W } from '../laila/sprite';
import { useSettings } from '../settings/settings';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { weatherLabelKey, type Weather } from '../widgets/weather/weatherService';
import {
  dismissSaver,
  IDLE_EVENT,
  INITIAL_SAVER,
  makeMotes,
  nextSaverState,
  type SaverState,
} from './saverLogic';

const WEATHER_CACHE_KEY = 'weather.cache';
const SPRITE_SCALE = 6;
const MOTE_COUNT = 24;
/** Gösterildikten sonra bu süre içindeki girdiler yok sayılır (açılışta kazara kapanmasın). */
const GRACE_MS = 800;
const MOVE_PX = 6;

/** Önbellekteki en yeni hava durumu satırı (ağ isteği yok). */
function useWeatherLine(active: boolean): string | null {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const load = () =>
      void readKey<Record<string, Weather>>(WEATHER_CACHE_KEY, {}).then((cache) => {
        if (!alive) return;
        const newest = Object.values(cache).sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
        setLine(newest ? `${Math.round(newest.temperature)}° · ${t(weatherLabelKey(newest.code))}` : null);
      });
    load();
    const off = onKeyChanged(WEATHER_CACHE_KEY, load);
    return () => {
      alive = false;
      off();
    };
  }, [active]);
  return line;
}

function Scene({ onDismiss }: { onDismiss: () => void }) {
  const now = useNow(1000);
  const date = new Date(now);
  const weather = useWeatherLine(true);
  const [bond] = usePersistentState<Bond>(BOND_KEY, DEFAULT_BOND, sanitizeBond);
  const sleepUrl = frameUrls(bond.outfit)['sleep'];
  const motes = useMemo(() => makeMotes(MOTE_COUNT), []);
  const shownAt = useRef(performance.now());
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setOverlay('screensaver', true);
    track('screensaver.seen');
    return () => setOverlay('screensaver', false);
  }, []);

  useEffect(() => {
    const live = () => performance.now() - shownAt.current > GRACE_MS;
    const onKey = () => live() && onDismiss();
    const onDown = () => live() && onDismiss();
    const onMove = (e: PointerEvent) => {
      const p = lastPos.current;
      lastPos.current = { x: e.clientX, y: e.clientY };
      if (p && live() && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_PX) onDismiss();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('wheel', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('wheel', onDown, true);
    };
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-label={t('screensaver.title')}
      className="fixed inset-0 z-[90] flex cursor-none select-none flex-col items-center justify-center overflow-hidden bg-bg/85 text-fg backdrop-blur-xl"
    >
      <style>{`
        @keyframes ss-rise { from { transform: translate3d(0, 0, 0); opacity: 0; } 10% { opacity: .6; } 90% { opacity: .6; } to { transform: translate3d(var(--ss-drift), -110vh, 0); opacity: 0; } }
        @keyframes ss-zzz { 0% { transform: translate(0, 0) scale(.7); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(18px, -42px) scale(1.15); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .ss-anim { animation: none !important; } }
      `}</style>

      {motes.map((m, i) => (
        <span
          key={i}
          aria-hidden
          className="ss-anim absolute rounded-full bg-fg/40"
          style={{
            left: `${m.x}%`,
            bottom: -12,
            width: m.size,
            height: m.size,
            animation: `ss-rise ${m.duration}s linear ${m.delay}s infinite`,
            ['--ss-drift' as string]: `${m.drift}vw`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="text-gradient text-8xl font-semibold tabular-nums tracking-tight">
          {date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-lg text-muted">
          {date.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        {weather && <div className="text-base text-muted">{weather}</div>}
      </div>

      <div className="relative mt-12" style={{ width: SPRITE_W * SPRITE_SCALE, height: SPRITE_H * SPRITE_SCALE }}>
        <img
          src={sleepUrl}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
        />
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="ss-anim absolute font-semibold text-accent"
            style={{
              left: '70%',
              top: '4%',
              fontSize: 14 + i * 4,
              animation: `ss-zzz 3.6s ease-out ${i * 1.2}s infinite`,
              opacity: 0,
            }}
          >
            z
          </span>
        ))}
      </div>

      <div className="absolute bottom-8 text-sm text-muted">{t('screensaver.dismissHint')}</div>
    </div>
  );
}

/** Boşta kalınca sakin bir sahne gösterir. Tam ekran yapmaz; yalnızca ana pencereyi kaplar. */
export function Screensaver() {
  const [settings] = useSettings();
  const [state, setState] = useState<SaverState>(INITIAL_SAVER);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    if (!isTauri()) return;
    let off: (() => void) | undefined;
    let alive = true;
    void listen<{ idleSeconds: number }>(IDLE_EVENT, async (event) => {
      const s = settingsRef.current;
      let mainVisible = false;
      try {
        const w = getCurrentWindow();
        mainVisible = (await w.isVisible()) && !(await w.isMinimized());
      } catch {
        mainVisible = false;
      }
      if (!alive) return;
      setState((prev) =>
        nextSaverState(prev, {
          enabled: s.screensaverEnabled,
          minutes: s.screensaverMinutes,
          idleSeconds: event.payload.idleSeconds,
          mainVisible,
        }),
      );
    }).then((fn) => {
      if (alive) off = fn;
      else fn();
    });
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  useEffect(() => {
    if (!settings.screensaverEnabled) setState((s) => (s.shown ? { shown: false, armed: s.armed } : s));
  }, [settings.screensaverEnabled]);

  if (!state.shown) return null;
  return <Scene onDismiss={() => setState(dismissSaver())} />;
}
