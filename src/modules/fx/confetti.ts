import { readKey } from '../../shared/lib/store';
import { DEFAULT_SETTINGS, sanitizeSettings, SETTINGS_KEY } from '../settings/settings';
import { burst, stepConfetto } from './particles';

const COLORS = ['#f472b6', '#facc15', '#34d399', '#60a5fa', '#a78bfa', '#fb923c'];

/** Kısa piksel konfeti patlaması (geçici tam ekran tuval; bitince kaldırılır). Ayar kapalıysa hiçbir şey yapmaz. */
export function celebrate(origin?: { x: number; y: number }): void {
  if (typeof document === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  void readKey<unknown>(SETTINGS_KEY, DEFAULT_SETTINGS)
    .then((raw) => {
      if (sanitizeSettings(raw).fxConfetti) run(origin);
    })
    .catch(() => undefined);
}

function run(origin?: { x: number; y: number }): void {
  const canvas = document.createElement('canvas');
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  document.body.appendChild(canvas);
  const o = origin ?? { x: w / 2, y: h * 0.6 };
  const items = burst(70, o.x, o.y, COLORS.length);
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);
    let alive = 0;
    for (const c of items) {
      if (c.life <= 0) continue;
      if (stepConfetto(c, dt)) alive++;
      ctx.globalAlpha = Math.min(1, Math.max(0, c.life * 2));
      ctx.fillStyle = COLORS[c.color] ?? '#fff';
      ctx.fillRect(Math.round(c.x), Math.round(c.y), c.size, c.size);
    }
    if (alive > 0) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
