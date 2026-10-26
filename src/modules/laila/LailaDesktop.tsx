import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { BOND_KEY, DEFAULT_BOND, sanitizeBond, type Bond } from './bond';
import { line, pick } from './brain';
import { landingLedge, matchLedge, pickJumpTarget, usableLedges, type Ledge } from './ledges';
import { lailaService, type LailaGeometry } from './lailaService';
import { currentHoliday } from '../fx/holidays';
import { accessoryFor, frameUrls, SPRITE_H, SPRITE_W, type FrameId } from './sprite';

/**
 * Laila'nın masaüstü hâli: birincil monitörün en altında (görev çubuğu üstünde) gezinen saydam pencere.
 * Konumlandırma fiziksel piksel cinsindendir; pencere yalnız konuşma balonu varken büyür.
 */

const SCALE = 2;
const SPRITE_LW = SPRITE_W * SCALE; // 48
const SPRITE_LH = SPRITE_H * SCALE; // 64
const BIG_LW = 240;
const BIG_LH = 150;
const SPEED = 30; // mantıksal px/sn
const TICK_MS = 40;
const CLIMB_MS = 800;
const BUBBLE_MS = 5000;
const LEDGE_REFRESH_MS = 2000;
const JUMP_MS = 700;

type Mode = 'walk' | 'idle' | 'wave';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function LailaDesktop() {
  const [frame, setFrame] = useState<FrameId>('stand');
  const [flip, setFlip] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0); // sprite'ın pencere içindeki sol boşluğu (mantıksal px)
  const api = useRef<{ poke: () => void }>({ poke: () => undefined });

  useEffect(() => {
    document.documentElement.classList.add('laila-window');
    return () => document.documentElement.classList.remove('laila-window');
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let ledgeTimer: number | undefined;

    void lailaService.geometry().then((geo: LailaGeometry) => {
      if (cancelled) return;
      const s = geo.scale || 1;
      const sw = SPRITE_LW * s;
      const sh = SPRITE_LH * s;
      const bottom = geo.y + geo.height;
      const minX = geo.x;
      const maxX = geo.x + geo.width - sw;
      const bigW = BIG_LW * s;
      const bigH = BIG_LH * s;

      let x = rand(minX, maxX);
      let dir = Math.random() < 0.5 ? -1 : 1;
      let top = bottom; // sprite üst kenarı (ekran)
      let phase: 'climb' | 'wander' | 'sink' = 'climb';
      let phaseStart = performance.now();
      const wanderMs = rand(45_000, 90_000);
      let mode: Mode = 'idle';
      let modeUntil = phaseStart + 600;
      let happyUntil = 0;
      let blinkUntil = 0;
      let nextBlink = phaseStart + rand(2500, 5000);
      let bubbleUntil = 0;
      let nextTalk = phaseStart + rand(12_000, 25_000);
      let lastKey = '';
      let last = phaseStart;
      let shown: { frame: FrameId; flip: boolean; bubble: string | null; off: number } = {
        frame: 'stand',
        flip: false,
        bubble: null,
        off: 0,
      };
      let bubbleText: string | null = null;

      // Pencere çıkıntıları (salt okunur): üstüne zıplayıp yürüyebilir, ucundan düşebilir.
      let ledges: Ledge[] = [];
      let surface: Ledge | null = null;
      let nextJump = phaseStart + rand(8000, 16_000);
      let jump: { t0: number; x0: number; top0: number; x1: number; top1: number; ledge: Ledge } | null = null;
      let falling: { vy: number; sinkAfter: boolean } | null = null;

      const startFall = (sinkAfter: boolean) => {
        surface = null;
        falling = { vy: 0, sinkAfter };
        bubbleText = null;
        bubbleUntil = 0;
      };

      const refreshLedges = () => {
        void lailaService
          .ledges()
          .then((raw) => {
            if (cancelled) return;
            ledges = usableLedges(raw, geo, sw, sh);
            if (surface && !jump) {
              const m = matchLedge(surface, ledges, x + sw / 2, 6 * s);
              if (m) {
                surface = m;
                top = m.y - sh;
              } else {
                startFall(false); // üzerinde durduğu pencere kımıldadı ya da kayboldu
              }
            }
          })
          .catch(() => undefined);
      };
      refreshLedges();
      ledgeTimer = window.setInterval(refreshLedges, LEDGE_REFRESH_MS);

      api.current.poke = () => {
        const now = performance.now();
        happyUntil = now + 1600;
        bubbleText = line('laila.lines.poke');
        bubbleUntil = now + BUBBLE_MS;
        nextTalk = Math.max(nextTalk, now + 8000);
      };

      const chooseMode = (now: number) => {
        const m = pick<Mode>(['walk', 'walk', 'walk', 'idle', 'idle', 'wave']) ?? 'walk';
        mode = m;
        if (m === 'walk') {
          if (Math.random() < 0.5) dir = -dir;
          modeUntil = now + rand(2500, 7000);
        } else if (m === 'wave') {
          modeUntil = now + 1800;
        } else {
          modeUntil = now + rand(2000, 5000);
        }
      };

      const tick = () => {
        if (cancelled) return;
        const now = performance.now();
        const dt = Math.min(0.25, (now - last) / 1000);
        last = now;

        if (phase === 'sink' && top >= bottom) {
          cancelled = true;
          if (timer !== undefined) window.clearInterval(timer);
          if (ledgeTimer !== undefined) window.clearInterval(ledgeTimer);
          void lailaService.comeBack();
          return;
        }

        if (phase === 'climb') {
          const p = Math.min(1, (now - phaseStart) / CLIMB_MS);
          top = bottom - sh * (1 - (1 - p) * (1 - p));
          if (p >= 1) {
            phase = 'wander';
            phaseStart = now;
            chooseMode(now);
          }
        } else if (phase === 'wander') {
          const expired = now - phaseStart > wanderMs;
          if (jump) {
            const p = Math.min(1, (now - jump.t0) / JUMP_MS);
            x = jump.x0 + (jump.x1 - jump.x0) * p;
            top = jump.top0 + (jump.top1 - jump.top0) * p - 4 * 50 * s * p * (1 - p);
            if (p >= 1) {
              x = jump.x1;
              top = jump.top1;
              surface = jump.ledge;
              jump = null;
              chooseMode(now);
            }
          } else if (falling) {
            const prevFeet = top + sh;
            falling.vy += 2400 * s * dt;
            top += falling.vy * dt;
            x = Math.min(maxX, Math.max(minX, x + dir * 25 * s * dt));
            const feet = top + sh;
            const land = falling.sinkAfter ? null : landingLedge(ledges, x + sw / 2, prevFeet, feet);
            if (land) {
              surface = land;
              top = land.y - sh;
              falling = null;
              chooseMode(now);
            } else if (feet >= bottom) {
              top = bottom - sh;
              const sinkAfter = falling.sinkAfter;
              falling = null;
              if (sinkAfter) {
                phase = 'sink';
                phaseStart = now;
              } else {
                chooseMode(now);
              }
            }
          } else if (expired) {
            if (surface) {
              startFall(true);
            } else {
              phase = 'sink';
              phaseStart = now;
              bubbleText = null;
              bubbleUntil = 0;
            }
          } else {
            if (now >= modeUntil) chooseMode(now);
            if (mode === 'walk') {
              x += dir * SPEED * s * dt;
              if (surface) {
                const c = x + sw / 2;
                if (c < surface.x || c > surface.x + surface.width) {
                  if (Math.random() < 0.5) {
                    x = c < surface.x ? surface.x - sw / 2 : surface.x + surface.width - sw / 2;
                    dir = -dir;
                  } else {
                    startFall(false);
                  }
                }
              } else if (x <= minX) {
                x = minX;
                dir = 1;
              } else if (x >= maxX) {
                x = maxX;
                dir = -1;
              }
            }
            if (!falling && now >= nextJump && bubbleText === null) {
              nextJump = now + rand(7000, 16_000);
              const tgt = pickJumpTarget(ledges, { x, feet: top + sh, spriteW: sw, scale: s }, surface);
              if (tgt && Math.random() < 0.7) {
                if (tgt.tx !== x) dir = tgt.tx > x ? 1 : -1;
                jump = { t0: now, x0: x, top0: top, x1: tgt.tx, top1: tgt.ledge.y - sh, ledge: tgt.ledge };
                surface = null;
              }
            }
            if (
              !falling &&
              !jump &&
              now >= nextTalk &&
              bubbleText === null &&
              top - (bigH - sh) >= geo.y
            ) {
              bubbleText = line('laila.lines.outsideTalk');
              bubbleUntil = now + BUBBLE_MS;
              nextTalk = now + rand(12_000, 25_000);
            }
          }
        } else {
          const p = Math.min(1, (now - phaseStart) / CLIMB_MS);
          top = p >= 1 ? bottom : bottom - sh * (1 - p * p);
        }

        if (bubbleText !== null && now >= bubbleUntil) bubbleText = null;

        if (now >= nextBlink) {
          blinkUntil = now + 150;
          nextBlink = now + rand(2500, 5500);
        }
        let f: FrameId = 'stand';
        if (phase === 'wander') {
          if (jump) f = 'happy';
          else if (falling) f = 'wave';
          else if (now < happyUntil) f = 'happy';
          else if (mode === 'walk') f = Math.floor(now / 180) % 2 === 0 ? 'stand' : 'walk';
          else if (mode === 'wave') f = 'wave';
          else if (now < blinkUntil) f = 'blink';
        }

        // Pencere yerleşimi: balon varken sprite aynı ekran noktasında kalır, pencere büyür.
        const room = top - (bigH - sh) >= geo.y;
        const shownBubble = room ? bubbleText : null;
        const big = shownBubble !== null;
        const w = Math.round(big ? bigW : sw);
        const h = Math.round(big ? bigH : sh);
        let wx = Math.round(x);
        let wy = Math.round(top);
        let off = 0;
        if (big) {
          const maxWx = Math.max(geo.x, geo.x + geo.width - bigW);
          wx = Math.round(Math.min(Math.max(x + sw / 2 - bigW / 2, geo.x), maxWx));
          wy = Math.round(top - (bigH - sh));
          off = Math.round((x - wx) / s);
        }

        const key = `${wx},${wy},${w},${h}`;
        if (key !== lastKey) {
          lastKey = key;
          void lailaService.place(wx, wy, w, h).catch(() => undefined);
        }

        const nextFlip = dir < 0;
        if (
          shown.frame !== f ||
          shown.flip !== nextFlip ||
          shown.bubble !== shownBubble ||
          shown.off !== off
        ) {
          shown = { frame: f, flip: nextFlip, bubble: shownBubble, off };
          setFrame(f);
          setFlip(nextFlip);
          setBubble(shownBubble);
          setOffsetX(off);
        }
      };

      timer = window.setInterval(tick, TICK_MS);
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      if (ledgeTimer !== undefined) window.clearInterval(ledgeTimer);
    };
  }, []);

  const [bond] = usePersistentState<Bond>(BOND_KEY, DEFAULT_BOND, sanitizeBond);
  const urls = frameUrls(bond.outfit, accessoryFor(currentHoliday()));
  const big = bubble !== null;

  return (
    <div
      className="relative select-none overflow-hidden"
      style={{ width: big ? BIG_LW : SPRITE_LW, height: big ? BIG_LH : SPRITE_LH }}
      title={t('laila.desktopHelp')}
    >
      {bubble && (
        <div
          className="absolute overflow-hidden rounded-2xl border border-stroke bg-card px-3 py-2 text-sm text-fg shadow-pop"
          style={{ left: 8, right: 8, bottom: SPRITE_LH + 4, maxHeight: BIG_LH - SPRITE_LH - 8 }}
        >
          {bubble}
        </div>
      )}
      <img
        src={urls[frame]}
        alt=""
        draggable={false}
        onClick={() => api.current.poke()}
        onDoubleClick={() => void lailaService.openMain()}
        style={{
          position: 'absolute',
          left: offsetX,
          bottom: 0,
          width: SPRITE_LW,
          height: SPRITE_LH,
          imageRendering: 'pixelated',
          transform: flip ? 'scaleX(-1)' : undefined,
          cursor: 'pointer',
        }}
      />
    </div>
  );
}
