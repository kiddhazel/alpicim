import { useEffect, useMemo, useRef, useState } from 'react';
import { useNow } from '../../shared/lib/hooks';
import { onKeyChanged, readKey } from '../../shared/lib/store';
import { useFocusOn } from '../focus/useFocus';
import { useSettings } from '../settings/settings';
import { useGameMode } from '../library/gameMode';
import type { Weather } from '../widgets/weather/weatherService';
import { DAYPARTS, daypartForHour, fireworksLive, sceneKinds, toneFor, weatherGroup, type Daypart, type Tone } from './ambient';
import { currentHoliday, type HolidayId } from './holidays';
import { particleCount, spawn, step, twinkle, type FxKind, type Particle } from './particles';
import { useFxPreview } from './preview';
import { explode, stepSpark, type Spark } from './sparks';

const CACHE_KEY = 'weather.cache';
const FRAME_MS = 1000 / 30;
const LIGHT_COLORS = ['255,90,90', '255,210,90', '110,220,130', '110,170,255'];

/** Önbellekteki en yeni hava durumu (yeni ağ isteği yok). */
function useLatestWeather(enabled: boolean): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      void readKey<Record<string, Weather>>(CACHE_KEY, {}).then((cache) => {
        if (!alive) return;
        const newest = Object.values(cache).sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
        setWeather(newest ?? null);
      });
    load();
    const off = onKeyChanged(CACHE_KEY, load);
    return () => {
      alive = false;
      off();
    };
  }, [enabled]);
  return weather;
}

function useReduced(): boolean {
  const [r, setR] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

function drawEmoji(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.font = `${Math.round(size)}px "Segoe UI Emoji", sans-serif`;
  ctx.fillText(ch, x, y);
  ctx.globalAlpha = 1;
}

function drawFlag(ctx: CanvasRenderingContext2D, p: Particle) {
  const w = p.size * 1.5;
  const h = p.size;
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#e30a17';
  for (let i = 0; i < w; i += 3) ctx.fillRect(p.x + i, p.y + Math.sin(p.phase * 2.2 + i * 0.18) * 3, 3, h);
  const dy = Math.sin(p.phase * 2.2 + w * 0.4 * 0.18) * 3;
  const cx = p.x + w * 0.38;
  const cy = p.y + h / 2 + dy;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, cy, h * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e30a17';
  ctx.beginPath();
  ctx.arc(cx + h * 0.06, cy, h * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx + h * 0.22, cy - 1.5, 3, 3);
  ctx.globalAlpha = 1;
}

function drawParticle(ctx: CanvasRenderingContext2D, kind: FxKind, p: Particle) {
  switch (kind) {
    case 'rain':
      ctx.strokeStyle = 'rgba(160,200,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 0.03, p.y - p.size);
      ctx.stroke();
      break;
    case 'snow':
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'cloud':
    case 'fog': {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      const a = kind === 'fog' ? 0.1 : 0.06;
      g.addColorStop(0, `rgba(200,210,225,${a})`);
      g.addColorStop(1, 'rgba(200,210,225,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      break;
    }
    case 'sun':
      ctx.fillStyle = `rgba(255,225,140,${0.5 * twinkle(p, 1.2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'stars':
      ctx.fillStyle = `rgba(255,255,230,${0.15 + 0.6 * twinkle(p, 1.6)})`;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      break;
    case 'bats':
      drawEmoji(ctx, '🦇', p.x, p.y + Math.sin(p.phase * 3) * 12, p.size, 0.45);
      break;
    case 'pumpkins':
      drawEmoji(ctx, '🎃', p.x, p.y + Math.sin(p.phase) * 8, p.size, 0.4);
      break;
    case 'ghost':
      drawEmoji(ctx, '👻', p.x, p.y + Math.sin(p.phase) * 10, p.size, 0.45 * Math.max(0, Math.sin(p.phase * 0.2)));
      break;
    case 'flags':
      drawFlag(ctx, p);
      break;
    case 'hearts':
      drawEmoji(ctx, '❤️', p.x + Math.sin(p.phase) * 14, p.y, p.size, 0.4);
      break;
    case 'balloons':
      drawEmoji(ctx, '🎈', p.x + Math.sin(p.phase * 0.8) * 16, p.y, p.size, 0.5);
      break;
    case 'kites':
      drawEmoji(ctx, '🪁', p.x, p.y + Math.sin(p.phase * 1.4) * 18, p.size, 0.5);
      break;
    case 'lanterns':
      ctx.fillStyle = 'rgba(255,190,90,0.07)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.6, 0, Math.PI * 2);
      ctx.fill();
      drawEmoji(ctx, '🏮', p.x - p.size / 2 + Math.sin(p.phase) * 8, p.y, p.size, 0.5);
      break;
    case 'crescent':
      drawEmoji(ctx, '🌙', p.x, p.y + Math.sin(p.phase * 0.5) * 6, p.size, 0.4);
      break;
    default:
  }
}

function drawLights(ctx: CanvasRenderingContext2D, w: number, t: number) {
  ctx.strokeStyle = 'rgba(120,120,120,0.35)';
  ctx.lineWidth = 1;
  const sag = (x: number) => 4 + 9 * Math.sin(Math.PI * ((x % 180) / 180));
  ctx.beginPath();
  ctx.moveTo(0, sag(0));
  for (let x = 10; x <= w; x += 10) ctx.lineTo(x, sag(x));
  ctx.stroke();
  for (let x = 12, i = 0; x < w; x += 36, i++) {
    const a = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7));
    ctx.fillStyle = `rgba(${LIGHT_COLORS[i % LIGHT_COLORS.length]},${a})`;
    ctx.beginPath();
    ctx.arc(x, sag(x) + 5, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Ortam: gün dilimi + hava + özel gün canvas katmanları. Yalnız "Hava efektleri" açıkken (veya önizlemede) çizilir; kök öznitelik/ton değişimi yok. */
function useFxScene() {
  const [settings] = useSettings();
  const reduced = useReduced();
  const preview = useFxPreview();
  const now = useNow(60_000);
  const weather = useLatestWeather(settings.fxWeather || settings.fxAmbient);

  const previewDaypart = (DAYPARTS as readonly string[]).includes(preview) ? (preview as Daypart) : null;
  const previewHoliday = previewDaypart || preview === 'none' ? null : (preview as HolidayId);
  const date = useMemo(() => new Date(now), [now]);
  const daypart = previewDaypart ?? daypartForHour(date.getHours());
  const holiday: HolidayId | null = previewHoliday ?? (settings.fxHolidays ? currentHoliday(date) : null);
  const showHoliday = holiday !== null && (settings.fxHolidays || previewHoliday !== null);
  const code = weather ? weather.code : previewDaypart !== null ? 0 : null;

  const focusOn = useFocusOn();
  const gameMode = useGameMode();
  const calm = !settings.performanceMode && !reduced && !gameMode && !focusOn;
  const decorOn = (settings.fxHolidays && settings.fxHolidayDecor) || previewHoliday !== null;
  const weatherOn = settings.fxWeather || previewDaypart !== null;
  const animate = calm && (weatherOn || (showHoliday && decorOn));
  const kinds = useMemo(
    () =>
      animate
        ? sceneKinds({
            daypart,
            weatherCode: code,
            holiday: showHoliday && decorOn ? holiday : null,
            weatherFx: weatherOn,
            ambientFx: weatherOn,
          })
        : [],
    [animate, daypart, code, showHoliday, decorOn, holiday, weatherOn],
  );
  const fireworks = showHoliday && decorOn && fireworksLive(holiday, date, previewHoliday !== null);
  const group = code === null ? null : weatherGroup(code);
  const tone: Tone | null = settings.fxAmbient || previewDaypart !== null ? toneFor(daypart, group) : null;
  return { kinds, fireworks, tone };
}

/** Ortam teması: yalnız --bg ve --layer-1 birkaç % kayar (CSS: html[data-tone]). */
function useApplyTone(tone: Tone | null) {
  useEffect(() => {
    const root = document.documentElement;
    if (tone) root.dataset.tone = tone;
    else delete root.dataset.tone;
    return () => {
      delete root.dataset.tone;
    };
  }, [tone]);
}

/** Arka katman (içeriğin altı): yağmur, bulut, sis, güneş parıltısı, yıldız. */
export function WeatherFx() {
  const { kinds, fireworks, tone } = useFxScene();
  useApplyTone(tone);
  return <FxCanvas kinds={kinds.filter((k) => BACK_KINDS.includes(k))} fireworks={fireworks} front={false} />;
}

/** Süs katmanı: WidgetBoard içinde, kartların ARKASINDA (yalnız boşluklarda görünür). */
export function FxDecor() {
  const { kinds, fireworks } = useFxScene();
  return <FxCanvas kinds={kinds.filter((k) => FRONT_KINDS.includes(k))} fireworks={fireworks} front />;
}

const BACK_KINDS: readonly FxKind[] = ['rain', 'cloud', 'fog', 'sun', 'stars'];
const FRONT_KINDS: readonly FxKind[] = ['snow', 'stars', 'bats', 'pumpkins', 'ghost', 'hearts', 'balloons', 'kites', 'flags', 'lanterns', 'crescent', 'lights', 'fireworks'];
const FRONT_CAP: Partial<Record<FxKind, number>> = { snow: 8, stars: 8, hearts: 4, lanterns: 3, flags: 2, balloons: 3, bats: 3, pumpkins: 2, kites: 2 };

function FxCanvas({ kinds, fireworks, front }: { kinds: FxKind[]; fireworks: boolean; front: boolean }) {
  const kindsKey = kinds.join(',');
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    const layers = kindsKey ? (kindsKey.split(',') as FxKind[]) : [];
    if (!canvas || !ctx || layers.length === 0) return;
    let w = 0;
    let h = 0;
    let parts = new Map<FxKind, Particle[]>();
    let sparks: Spark[] = [];
    let nextFirework = 1;
    let clock = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w;
      canvas.height = h;
      parts = new Map(
        layers.map((k) => {
          const n = front ? Math.min(particleCount(k, w, h), FRONT_CAP[k] ?? 2) : particleCount(k, w, h);
          return [
            k,
            Array.from({ length: n }, () => {
              const p = spawn(k, w, h);
              if (front) {
                if (k === 'stars') p.x = (Math.random() < 0.5 ? Math.random() * 0.1 : 0.9 + Math.random() * 0.1) * w;
                if (k !== 'crescent' && k !== 'ghost') p.size = Math.min(p.size, 20);
              }
              return p;
            }),
          ];
        }),
      );
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();
    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || nowMs - last < FRAME_MS) return;
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      clock += dt;
      ctx.clearRect(0, 0, w, h);
      ctx.textBaseline = 'top';
      for (const [kind, list] of parts) {
        for (const p of list) {
          step(p, kind, dt, w, h);
          drawParticle(ctx, kind, p);
        }
      }
      if (front && layers.includes('lights')) drawLights(ctx, w, clock);
      if (layers.includes('fireworks') && fireworks) {
        nextFirework -= dt;
        if (nextFirework <= 0) {
          sparks.push(...explode(w * (0.15 + Math.random() * 0.7), h * (0.1 + Math.random() * 0.35)));
          nextFirework = 3 + Math.random() * 5;
        }
        sparks = sparks.filter((s) => stepSpark(s, dt));
        for (const s of sparks) {
          ctx.fillStyle = `hsla(${s.hue},90%,65%,${Math.min(1, s.life)})`;
          ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [kindsKey, fireworks, front]);

  if (kinds.length === 0) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={front ? 'pointer-events-none absolute inset-0 z-0 h-full w-full' : 'pointer-events-none absolute inset-0 -z-10 h-full w-full'}
    />
  );
}
