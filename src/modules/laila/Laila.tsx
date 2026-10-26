import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { t } from '../../i18n';
import { setOverlay } from '../../shared/lib/overlay';
import { isTauri } from '../../shared/lib/tauri';
import { subscribe } from '../display/displayService';
import { useSettings } from '../settings/settings';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { dayPart, greetingKey, idleLine, line, linesOf, nextBehavior, pick, reply, talkDelayMs, type Behavior, type ReplyAction } from './brain';
import { BOND_KEY, DEFAULT_BOND, dayKey, newlyUnlocked, pet as petBond, registerVisit, sanitizeBond, selectOutfit, type Bond, type BondChange } from './bond';
import { LailaChat, type ChatMessage } from './LailaChat';
import { LAILA_CHAT_EVENT, LAILA_LEAVE_EVENT, LAILA_PLAY_END_EVENT, LAILA_PLAY_EVENT, POMODORO_DONE_EVENT, type LailaPlayEnd } from './lailaEvents';
import { currentHoliday } from '../fx/holidays';
import { readKey, writeKey } from '../../shared/lib/store';
import { track } from '../../shared/lib/track';
import { cx } from '../../shared/ui/primitives';
import { useMediaSession } from '../system/systemService';
import { weatherLabelKey } from '../widgets/weather/weatherService';
import { BRIEFING_KEY, briefingLines, dayString, nextEvent, pickRates, pickWeather, shouldBrief, topHeadline } from './briefing';
import { adjust, applyDecay, defaultNeeds, feed as feedNeeds, moodOf, NEEDS_KEY, sanitizeNeeds, type Needs, type SnackId } from './needs';
import { acknowledge, dueReminder, snooze, type ReminderClock, type ReminderKind } from './reminders';
import { LAILA_RETURN_EVENT, lailaService } from './lailaService';
import { accessoryFor, frameUrls, heartUrl, SPRITE_H, SPRITE_W, type FrameId, type OutfitId } from './sprite';

const SCALE = 2;
const W = SPRITE_W * SCALE;
const H = SPRITE_H * SCALE;
const SPEED = 30;
const LEAVE_COOLDOWN_MS = 3 * 60_000;
const BUBBLE_MS = 5000;

type Side = 'top' | 'left' | 'right';
interface Card {
  left: number;
  top: number;
  width: number;
  height: number;
  sides: Side[];
}

interface Beh {
  kind: Behavior;
  t0: number;
  dur: number;
  tx: number;
  happyOnly: boolean;
  card?: Card;
  side?: Side;
  px: number;
  py: number;
  holdMs: number;
  spoke: boolean;
  /** play: 0 yürü, 1 bekle, 2 tepki. */
  phase: number;
}

interface Api {
  poke: () => void;
  act: (action: ReplyAction) => void;
  leave: () => void;
  hearts: (n: number) => void;
  petStart: () => boolean;
  petEnd: () => void;
  isAway: () => boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Laila: ana pencerenin içinde gezen piksel arkadaş. Konum doğrudan DOM üzerinde güncellenir (kare başına React yok). */
export function Laila({ hostRef, panel }: { hostRef: RefObject<HTMLElement | null>; panel: string | undefined }) {
  const [settings] = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const panelRef = useRef(panel);
  panelRef.current = panel;

  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const bubbleTimer = useRef<number | undefined>(undefined);
  const chatOpenRef = useRef(false);

  const [bubble, setBubble] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBottom, setChatBottom] = useState(12);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const nextId = useRef(1);

  const [bond, setBond, bondLoaded] = usePersistentState<Bond>(BOND_KEY, DEFAULT_BOND, sanitizeBond);
  const bondRef = useRef(bond);
  bondRef.current = bond;
  const outfitRef = useRef<OutfitId>(bond.outfit);
  outfitRef.current = bond.outfit;
  const holdTimer = useRef<number | undefined>(undefined);
  const heartTimer = useRef<number | undefined>(undefined);
  const petting = useRef(false);
  const visited = useRef(false);

  // İhtiyaçlar (kalıcı, gerçek zamanda azalır; asla cezalandırıcı değil).
  const [needs, setNeeds, needsLoaded] = usePersistentState<Needs>(NEEDS_KEY, defaultNeeds(Date.now()), (raw) => sanitizeNeeds(raw));
  const needsRef = useRef(needs);
  needsRef.current = needs;
  const needsLoadedRef = useRef(needsLoaded);
  needsLoadedRef.current = needsLoaded;
  const changeNeeds = (fn: (n: Needs) => Needs) => {
    if (!needsLoadedRef.current) return;
    const next = fn(needsRef.current);
    if (next === needsRef.current) return;
    needsRef.current = next;
    setNeeds(next);
  };
  const changeNeedsRef = useRef(changeNeeds);
  changeNeedsRef.current = changeNeeds;
  const sleepyRef = useRef(false);
  sleepyRef.current = moodOf(needs) === 'sleepy';
  const musicRef = useRef(false);
  const needsEventRef = useRef<(e: 'rest' | 'dance') => void>(() => {});
  needsEventRef.current = (e) => changeNeeds((n) => adjust(n, e === 'rest' ? { energy: 12 } : { fun: 3 }));

  // Müzik çalıyor mu? (SMTC; mevcut medya oturumu kancası)
  const media = useMediaSession(10_000, isTauri() && !settings.performanceMode);
  musicRef.current = media.session?.status === 'playing';

  const commit = (c: BondChange) => {
    if (c.bond === bondRef.current) return;
    const prev = bondRef.current;
    bondRef.current = c.bond;
    setBond(c.bond);
    const unlocked = newlyUnlocked(prev.points, c.bond.points);
    const id = unlocked[unlocked.length - 1];
    if (id) {
      const tpl = pick(linesOf('laila.lines.unlock')) ?? '';
      sayRef.current(tpl.replace(/\{name\}/g, t(`laila.outfit.${id}`)));
      apiRef.current?.hearts(6);
    } else if (c.gained > 0) {
      apiRef.current?.hearts(Math.min(4, c.gained));
    }
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const award = () => {
    if (!bondLoaded) return;
    commit(petBond(bondRef.current, dayKey(new Date())));
  };

  useEffect(() => {
    if (!bondLoaded || visited.current) return;
    visited.current = true;
    const v = registerVisit(bondRef.current, dayKey(new Date()));
    if (!v.newDay) return;
    commitRef.current(v);
    const tm = window.setTimeout(() => {
      sayRef.current(v.bond.streakDays >= 2 ? t('laila.lines.streak', { days: v.bond.streakDays }) : line('laila.lines.daily'));
    }, 7500);
    return () => window.clearTimeout(tm);
  }, [bondLoaded]);

  chatOpenRef.current = chatOpen;
  useEffect(() => {
    setOverlay('laila-chat', chatOpen);
    return () => setOverlay('laila-chat', false);
  }, [chatOpen]);

  const [bubbleAction, setBubbleAction] = useState<ReminderKind | null>(null);
  const say = (text: string, ms = BUBBLE_MS, action: ReminderKind | null = null) => {
    window.clearTimeout(bubbleTimer.current);
    setBubble(text);
    setBubbleAction(action);
    bubbleTimer.current = window.setTimeout(() => {
      setBubble(null);
      setBubbleAction(null);
    }, ms);
  };
  const sayRef = useRef(say);
  sayRef.current = say;
  useEffect(() => () => window.clearTimeout(bubbleTimer.current), []);
  // Oyun modu: bir kez "İyi oyunlar!" der, oyun sürerken gizlenir.
  const [gameHidden, setGameHidden] = useState(false);
  useEffect(() => {
    let timer = 0;
    const onMode = (e: Event) => {
      window.clearTimeout(timer);
      if ((e as CustomEvent<{ active?: boolean }>).detail?.active) {
        sayRef.current(t('library.gameMode'), 3000);
        timer = window.setTimeout(() => setGameHidden(true), 3200);
      } else {
        setGameHidden(false);
      }
    };
    window.addEventListener('alpicim:game-mode', onMode);
    return () => {
      window.removeEventListener('alpicim:game-mode', onMode);
      window.clearTimeout(timer);
    };
  }, []);

  // Hareket motoru.
  useEffect(() => {
    const host = hostRef.current;
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!host || !wrap || !img) return;
    const speak = (text: string, ms?: number) => sayRef.current(text, ms);
    const holiday = currentHoliday();
    const accessory = accessoryFor(holiday);

    let raf = 0;
    let last = performance.now();
    let lastDraw = 0;
    let hostW = host.clientWidth;
    let hostH = host.clientHeight;
    let floor = hostH - H;
    let floorAt = 0;
    let x = rand(0, Math.max(0, hostW - W));
    let y = floor;
    let facing: 1 | -1 = 1;
    let frame: FrameId = 'stand';
    let bob = 0;
    let away = false;
    let comeBackSent = false;
    let lastLeave = performance.now();
    let clip = '';
    let shownFrame: FrameId | null = null;
    let shownOutfit: OutfitId | null = null;
    let petting = false;
    let nextNote = 0;
    let shownFacing = 0;
    let beh: Beh = { kind: 'idle', t0: last, dur: 1500, tx: x, happyOnly: false, px: 0, py: 0, holdMs: 0, spoke: false, phase: 0 };

    const measure = (now: number) => {
      hostW = host.clientWidth;
      hostH = host.clientHeight;
      if (floorAt && now - floorAt < 400) return;
      floorAt = now;
      const footer = host.querySelector(':scope > footer');
      if (footer) floor = footer.getBoundingClientRect().top - host.getBoundingClientRect().top - H + 3;
      else floor = hostH - H;
    };

    const findCards = (): Card[] => {
      const hr = host.getBoundingClientRect();
      const out: Card[] = [];
      host.querySelectorAll<HTMLElement>('[data-laila-hide]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 60 || r.height < 40) return;
        const c: Card = { left: r.left - hr.left, top: r.top - hr.top, width: r.width, height: r.height, sides: [] };
        if (c.left < 0 || c.top < 0 || c.left + c.width > hr.width || c.top + c.height > hr.height) return;
        if (c.top >= H * 0.5) c.sides.push('top');
        if (c.left >= W * 0.5) c.sides.push('left');
        if (hr.width - (c.left + c.width) >= W * 0.5) c.sides.push('right');
        if (c.sides.length) out.push(c);
      });
      return out;
    };

    const canLeave = () =>
      settingsRef.current.lailaDesktop && isTauri() && !away && performance.now() - lastLeave >= LEAVE_COOLDOWN_MS;

    const start = (kind: Behavior, opts: { happyOnly?: boolean } = {}) => {
      const now = performance.now();
      measure(now);
      beh = { kind, t0: now, dur: 0, tx: x, happyOnly: opts.happyOnly ?? false, px: 0, py: 0, holdMs: 0, spoke: false, phase: 0 };
      clip = '';
      bob = 0;
      if (kind !== 'peek') y = floor;
      switch (kind) {
        case 'walk':
          beh.tx = rand(0, Math.max(0, hostW - W));
          break;
        case 'idle':
          beh.dur = chatOpenRef.current ? 600_000 : rand(3000, 7000);
          if (chatOpenRef.current) facing = 1;
          frame = 'stand';
          break;
        case 'wave':
          beh.dur = 1600;
          break;
        case 'sleep':
          beh.dur = rand(6000, 10_000);
          speak(line('laila.lines.sleep'), beh.dur);
          break;
        case 'peek': {
          const cards = findCards();
          const card = cards[Math.floor(Math.random() * cards.length)];
          const side = card ? card.sides[Math.floor(Math.random() * card.sides.length)] : undefined;
          if (!card || !side) {
            start('idle');
            return;
          }
          beh.card = card;
          beh.side = side;
          beh.holdMs = rand(3000, 5000);
          if (side === 'top') {
            beh.px = card.width > W ? card.left + rand(0, card.width - W) : card.left + (card.width - W) / 2;
          } else {
            beh.py = card.height > H ? card.top + rand(0, card.height - H) : card.top + (card.height - H) / 2;
          }
          if (side === 'left') facing = -1;
          if (side === 'right') facing = 1;
          break;
        }
        case 'play':
          beh.tx = clamp(hostW / 2 - W / 2 + rand(-80, 80), 0, Math.max(0, hostW - W));
          break;
        case 'dance':
          beh.tx = clamp(hostW - W - 30 - rand(0, 150), 0, Math.max(0, hostW - W));
          break;
        case 'leave':
          lastLeave = now;
          facing = 1;
          beh.tx = hostW + 4;
          speak(line('laila.lines.outside'));
          break;
      }
    };

    const hearts = (n: number) => {
      const layer = wrap.parentElement;
      if (!layer || away) return;
      for (let i = 0; i < n; i++) {
        const h = document.createElement('img');
        h.src = heartUrl();
        h.alt = '';
        Object.assign(h.style, {
          position: 'absolute',
          left: `${x + W / 2 - 7 + rand(-16, 16)}px`,
          top: `${y + rand(3, 16)}px`,
          width: '14px',
          height: '12px',
          imageRendering: 'pixelated',
          pointerEvents: 'none',
        });
        layer.appendChild(h);
        const anim = h.animate(
          [
            { transform: 'translateY(0)', opacity: 1 },
            { transform: `translateY(-${rand(28, 48)}px)`, opacity: 0 },
          ],
          { duration: rand(1000, 1500), delay: i * 130, easing: 'ease-out', fill: 'both' },
        );
        anim.onfinish = () => h.remove();
      }
    };

    const notes = () => {
      const layer = wrap.parentElement;
      if (!layer || away) return;
      const n = document.createElement('div');
      n.textContent = '♪';
      Object.assign(n.style, {
        position: 'absolute',
        left: `${x + W / 2 + rand(-18, 18)}px`,
        top: `${y - 2}px`,
        fontSize: '16px',
        fontWeight: '700',
        color: 'var(--accent)',
        pointerEvents: 'none',
      });
      layer.appendChild(n);
      const anim = n.animate(
        [
          { transform: 'translate(0,0)', opacity: 1 },
          { transform: `translate(${rand(-14, 14)}px,-${rand(30, 50)}px)`, opacity: 0 },
        ],
        { duration: rand(1100, 1600), easing: 'ease-out', fill: 'both' },
      );
      anim.onfinish = () => n.remove();
    };

    const pickNext = () => {
      if (chatOpenRef.current) {
        start('idle');
        return;
      }
      start(nextBehavior({ canPeek: findCards().length > 0, canLeave: canLeave(), hour: new Date().getHours(), canPlay: panelRef.current === 'games', waveBoost: holiday === 'republic', canDance: musicRef.current, sleepy: sleepyRef.current }));
    };

    const walkTo = (dt: number, now: number, speed: number): boolean => {
      const dir = beh.tx >= x ? 1 : -1;
      facing = dir;
      x += dir * speed * dt;
      const reached = dir === 1 ? x >= beh.tx : x <= beh.tx;
      frame = Math.floor((now - beh.t0) / 180) % 2 === 0 ? 'walk' : 'stand';
      bob = frame === 'walk' ? 1 : 0;
      if (reached) x = beh.tx;
      return reached;
    };

    const update = (dt: number, now: number) => {
      measure(now);
      if (away) {
        if (!settingsRef.current.lailaDesktop && !comeBackSent) {
          comeBackSent = true;
          lailaService.comeBack().catch(() => {});
        }
        return;
      }
      switch (beh.kind) {
        case 'walk':
          if (walkTo(dt, now, SPEED)) pickNext();
          break;
        case 'idle':
          frame = (now - beh.t0) % 3000 >= 2850 || (sleepyRef.current && (now - beh.t0) % 3000 >= 1500) ? 'blink' : 'stand';
          if (now - beh.t0 >= beh.dur) pickNext();
          break;
        case 'wave':
          frame = beh.happyOnly || Math.floor((now - beh.t0) / 400) % 2 === 1 ? 'happy' : 'wave';
          if (now - beh.t0 >= beh.dur) pickNext();
          break;
        case 'sleep':
          frame = 'sleep';
          if (now - beh.t0 >= beh.dur) {
            needsEventRef.current('rest');
            pickNext();
          }
          break;
        case 'peek': {
          const { card, side } = beh;
          if (!card || !side) {
            pickNext();
            break;
          }
          const e = now - beh.t0;
          const IN = 600;
          const total = IN + beh.holdMs + IN;
          let vis = 0.45;
          if (e < IN) vis = 0.45 * (e / IN);
          else if (e > IN + beh.holdMs) vis = 0.45 * Math.max(0, 1 - (e - IN - beh.holdMs) / IN);
          if (e >= IN && !beh.spoke) {
            beh.spoke = true;
            if (Math.random() < 0.5) speak(line('laila.lines.peek'));
          }
          frame = e >= IN && e <= IN + beh.holdMs ? 'look' : 'stand';
          if (side === 'top') {
            x = beh.px;
            y = card.top - vis * H;
            clip = `inset(0px 0px ${Math.max(0, y + H - card.top)}px 0px)`;
          } else if (side === 'left') {
            y = beh.py;
            x = card.left - vis * W;
            clip = `inset(0px ${Math.max(0, x + W - card.left)}px 0px 0px)`;
          } else {
            y = beh.py;
            x = card.left + card.width - W + vis * W;
            clip = `inset(0px 0px 0px ${Math.max(0, card.left + card.width - x)}px)`;
          }
          if (e >= total) {
            clip = '';
            frame = 'stand';
            x = rand(0, Math.max(0, hostW - W));
            y = floor;
            pickNext();
          }
          break;
        }
        case 'play':
          if (beh.phase === 0) {
            if (walkTo(dt, now, SPEED + 10)) {
              beh.phase = 1;
              beh.t0 = now;
              speak(line('laila.lines.play'));
              window.dispatchEvent(new Event(LAILA_PLAY_EVENT));
            }
          } else if (beh.phase === 1) {
            frame = Math.floor((now - beh.t0) / 500) % 2 === 0 ? 'happy' : 'look';
            bob = 0;
            if (now - beh.t0 >= 60_000) {
              speak(line('laila.lines.playStopped'));
              beh.phase = 2;
              beh.t0 = now;
              beh.dur = 1800;
            }
          } else {
            frame = beh.holdMs === 1 ? (Math.floor((now - beh.t0) / 400) % 2 === 0 ? 'wave' : 'happy') : 'stand';
            if (now - beh.t0 >= beh.dur) pickNext();
          }
          break;
        case 'dance':
          if (beh.phase === 0) {
            if (!musicRef.current) {
              pickNext();
              break;
            }
            if (walkTo(dt, now, SPEED + 10)) {
              beh.phase = 1;
              beh.t0 = now;
              beh.dur = rand(8000, 14_000);
              nextNote = now;
              speak(line('laila.lines.dance'));
            }
          } else {
            const idx = Math.floor((now - beh.t0) / 350);
            frame = idx % 2 === 0 ? 'dance1' : 'dance2';
            bob = idx % 2 === 0 ? 0 : -2;
            if (now >= nextNote) {
              nextNote = now + 700;
              notes();
            }
            if (now - beh.t0 >= beh.dur || !musicRef.current) {
              needsEventRef.current('dance');
              pickNext();
            }
          }
          break;
        case 'leave':
          if (walkTo(dt, now, SPEED + 10)) {
            away = true;
            comeBackSent = false;
            wrap.style.display = 'none';
            lailaService.goOutside().catch(() => {
              away = false;
              wrap.style.display = '';
              x = hostW;
              start('walk');
            });
          }
          break;
      }
      if (beh.kind !== 'peek') {
        y = floor;
        if (beh.kind !== 'leave') x = clamp(x, 0, Math.max(0, hostW - W));
      }
    };

    const draw = () => {
      if (away) return;
      if (frame !== shownFrame || outfitRef.current !== shownOutfit) {
        shownFrame = frame;
        shownOutfit = outfitRef.current;
        img.src = frameUrls(shownOutfit, accessory)[frame];
      }
      if (facing !== shownFacing) {
        shownFacing = facing;
        img.style.transform = facing < 0 ? 'scaleX(-1)' : 'none';
      }
      wrap.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y + bob)}px,0)`;
      wrap.style.clipPath = clip || 'none';
      const bubbleEl = bubbleRef.current;
      if (bubbleEl) {
        const bw = bubbleEl.offsetWidth;
        const bh = bubbleEl.offsetHeight;
        bubbleEl.style.left = `${clamp(x + W / 2 - bw / 2, 4, Math.max(4, hostW - bw - 4))}px`;
        const above = y - bh - 4;
        bubbleEl.style.top = `${above >= 4 ? above : Math.min(hostH - bh - 4, y + H + 4)}px`;
      }
    };

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      const gap = settingsRef.current.performanceMode ? 66 : 0;
      if (ts - lastDraw < gap) return;
      lastDraw = ts;
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      update(dt, now);
      draw();
    };

    measure(performance.now());
    y = floor;
    start('idle');
    raf = requestAnimationFrame(tick);

    const onPlayEnd = (e: Event) => {
      if (beh.kind !== 'play' || beh.phase !== 1) return;
      const res = (e as CustomEvent<LailaPlayEnd | undefined>).detail?.result ?? 'stopped';
      beh.phase = 2;
      beh.t0 = performance.now();
      beh.dur = res === 'win' ? 2600 : 2000;
      beh.holdMs = res === 'win' ? 1 : 0;
      speak(line(res === 'win' ? 'laila.lines.playWin' : res === 'lose' ? 'laila.lines.playLose' : 'laila.lines.playStopped'));
      if (res === 'win') hearts(4);
    };
    window.addEventListener(LAILA_PLAY_END_EVENT, onPlayEnd);

    const off = subscribe<unknown>(LAILA_RETURN_EVENT, () => {
      if (!away) return;
      away = false;
      wrap.style.display = '';
      measure(performance.now());
      x = hostW;
      start('walk');
      beh.tx = clamp(hostW - W - rand(40, 240), 0, Math.max(0, hostW - W));
      speak(line('laila.lines.back'));
    });

    const greet = window.setTimeout(() => speak(holiday ? line(`laila.holiday.${holiday}`) : line(greetingKey(dayPart(new Date().getHours())))), 2000);

    apiRef.current = {
      poke: () => {
        if (away || beh.kind === 'peek' || beh.kind === 'leave' || beh.kind === 'play' || beh.kind === 'dance') return;
        start('wave');
        speak(line('laila.lines.poke'));
      },
      hearts,
      isAway: () => away,
      petStart: () => {
        if (away || beh.kind === 'peek' || beh.kind === 'leave' || beh.kind === 'play' || beh.kind === 'dance') return false;
        start('wave', { happyOnly: true });
        beh.dur = 600_000;
        petting = true;
        return true;
      },
      petEnd: () => {
        if (petting && beh.kind === 'wave') beh.dur = 1;
        petting = false;
      },
      leave: () => {
        if (away || !settingsRef.current.lailaDesktop || !isTauri()) return;
        setChatOpenRef.current(false);
        start('leave');
      },
      act: (action) => {
        if (away) return;
        if (action === 'wave' || action === 'happy') start('wave', { happyOnly: action === 'happy' });
        else if (action === 'peek') start('peek');
        else if (action === 'sleep') start('sleep');
        else if (action === 'play' && panelRef.current === 'games') start('play');
        // Sohbetten açıkça istenince bekleme süresi aranmaz.
        else if (action === 'leave' && settingsRef.current.lailaDesktop && isTauri() && !away) start('leave');
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(greet);
      off();
      window.removeEventListener(LAILA_PLAY_END_EVENT, onPlayEnd);
      apiRef.current = null;
      if (away) lailaService.comeBack().catch(() => {});
    };
  }, [hostRef]);

  // Kendiliğinden konuşma.
  const chatty = settings.lailaChat;
  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      const delay = talkDelayMs(chatty);
      if (delay === null) return;
      timer = window.setTimeout(() => {
        if (!chatOpenRef.current) {
          const mood = moodOf(needsRef.current);
          if (mood !== 'ok' && Math.random() < 0.6) sayRef.current(line(`laila.lines.${mood}`));
          else sayRef.current(idleLine({ hour: new Date().getHours(), panel: panelRef.current }));
        }
        schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [chatty]);

  // Azalma: açılışta ve her dakika.
  useEffect(() => {
    if (!needsLoaded) return;
    const decay = () => changeNeedsRef.current((n) => applyDecay(n, Date.now()));
    decay();
    const id = window.setInterval(decay, 60_000);
    return () => window.clearInterval(id);
  }, [needsLoaded]);

  // Oyun bitince eğlence artar; pomodoro bitince tebrik.
  useEffect(() => {
    const onEnd = (e: Event) => {
      const res = (e as CustomEvent<LailaPlayEnd | undefined>).detail?.result ?? 'stopped';
      changeNeedsRef.current((n) => adjust(n, { fun: res === 'win' ? 20 : res === 'lose' ? 12 : 4 }));
    };
    const onPomodoro = () => {
      sayRef.current(line('laila.lines.pomodoro'));
      apiRef.current?.act('happy');
      apiRef.current?.hearts(4);
      changeNeedsRef.current((n) => adjust(n, { fun: 5 }));
    };
    window.addEventListener(LAILA_PLAY_END_EVENT, onEnd);
    window.addEventListener(POMODORO_DONE_EVENT, onPomodoro);
    return () => {
      window.removeEventListener(LAILA_PLAY_END_EVENT, onEnd);
      window.removeEventListener(POMODORO_DONE_EVENT, onPomodoro);
    };
  }, []);

  // Sağlık hatırlatıcıları.
  const clockRef = useRef<ReminderClock>({ eye: Date.now(), water: Date.now() });
  const reminderMinutes = () => ({ eye: settingsRef.current.lailaEyeMin, water: settingsRef.current.lailaWaterMin });
  useEffect(() => {
    if (!settings.lailaReminders) return;
    clockRef.current = { eye: Date.now(), water: Date.now() };
    const id = window.setInterval(() => {
      if (chatOpenRef.current || apiRef.current?.isAway() !== false) return;
      const now = Date.now();
      const kind = dueReminder(clockRef.current, now, reminderMinutes());
      if (!kind) return;
      // Yanıtlanmazsa 5 dk sonra tekrar hatırlatır.
      clockRef.current = snooze(clockRef.current, kind, now, reminderMinutes());
      sayRef.current(line(kind === 'eye' ? 'laila.lines.reminderEye' : 'laila.lines.reminderWater'), 15_000, kind);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [settings.lailaReminders]);
  const reminderOk = (kind: ReminderKind) => {
    clockRef.current = acknowledge(clockRef.current, kind, Date.now());
    track('reminder.followed');
    apiRef.current?.hearts(2);
    sayRef.current(line('laila.lines.reminderDone'), 3500);
  };
  const reminderLater = (kind: ReminderKind) => {
    clockRef.current = snooze(clockRef.current, kind, Date.now(), reminderMinutes());
    window.clearTimeout(bubbleTimer.current);
    setBubble(null);
    setBubbleAction(null);
  };

  // Sabah özeti (önbellekten; ağ isteği yok).
  const briefTimers = useRef<number[]>([]);
  const runBriefing = async () => {
    const [w, m, ws, news] = await Promise.all([
      readKey<unknown>('weather.cache', null),
      readKey<unknown>('markets.cache', null),
      readKey<unknown>('workspaces', null),
      readKey<unknown>('news.cache', null),
    ]);
    const now = new Date();
    const today = dayString(now);
    const wb = pickWeather(w);
    const rates = pickRates(m);
    const pad = (n: number) => String(n).padStart(2, '0');
    const lines = briefingLines(
      {
        weather: wb ? { ...wb, desc: t(weatherLabelKey(wb.code)).toLocaleLowerCase('tr') } : null,
        usd: rates.usd,
        eur: rates.eur,
        event: nextEvent(ws, today, `${pad(now.getHours())}:${pad(now.getMinutes())}`),
        headline: topHeadline(news),
      },
      today,
    );
    track('briefing.seen');
    void writeKey(BRIEFING_KEY, today);
    apiRef.current?.act('wave');
    briefTimers.current.forEach((id) => window.clearTimeout(id));
    briefTimers.current = lines.map((l, i) => window.setTimeout(() => sayRef.current(l, 5500), i * 5800));
  };
  const runBriefingRef = useRef(runBriefing);
  runBriefingRef.current = runBriefing;
  useEffect(() => {
    const tm = window.setTimeout(() => {
      void readKey<unknown>(BRIEFING_KEY, null).then((last) => {
        if (shouldBrief(new Date(), typeof last === 'string' ? last : null)) void runBriefingRef.current();
      });
    }, 13_500);
    return () => {
      window.clearTimeout(tm);
      briefTimers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const feedSnack = (id: SnackId) => {
    const before = needsRef.current;
    changeNeeds((n) => feedNeeds(n, id, Date.now()));
    if (needsRef.current === before) return;
    track('laila.fed');
    apiRef.current?.hearts(2);
    apiRef.current?.act('happy');
    sayRef.current(line('laila.lines.fed'));
  };

  const openChat = () => {
    if (chatOpenRef.current) return;
    const host = hostRef.current;
    const footer = host?.querySelector(':scope > footer');
    if (host && footer) setChatBottom(host.getBoundingClientRect().bottom - footer.getBoundingClientRect().top + 8);
    else setChatBottom(12);
    setChatOpen(true);
  };
  const toggleChat = () => {
    apiRef.current?.poke();
    if (chatOpenRef.current) setChatOpen(false);
    else openChat();
  };

  const endPet = () => {
    window.clearTimeout(holdTimer.current);
    window.clearInterval(heartTimer.current);
    if (petting.current) apiRef.current?.petEnd();
  };
  const onDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    petting.current = false;
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      if (!apiRef.current?.petStart()) return;
      petting.current = true;
      sayRef.current(line('laila.lines.pet'));
      apiRef.current?.hearts(3);
      award();
      heartTimer.current = window.setInterval(() => apiRef.current?.hearts(1), 700);
    }, 600);
  };
  const onUp = () => {
    const wasPet = petting.current;
    endPet();
    petting.current = false;
    if (wasPet) return;
    toggleChat();
    award();
  };
  const onCancel = () => {
    endPet();
    petting.current = false;
  };
  useEffect(() => () => {
    window.clearTimeout(holdTimer.current);
    window.clearInterval(heartTimer.current);
  }, []);

  const pickOutfit = (id: OutfitId) => {
    const next = selectOutfit(bondRef.current, id);
    if (next === bondRef.current) return;
    bondRef.current = next;
    setBond(next);
  };
  const openChatRef = useRef(openChat);
  openChatRef.current = openChat;
  const setChatOpenRef = useRef(setChatOpen);
  useEffect(() => {
    const onChat = () => openChatRef.current();
    const onLeave = () => apiRef.current?.leave();
    window.addEventListener(LAILA_CHAT_EVENT, onChat);
    window.addEventListener(LAILA_LEAVE_EVENT, onLeave);
    return () => {
      window.removeEventListener(LAILA_CHAT_EVENT, onChat);
      window.removeEventListener(LAILA_LEAVE_EVENT, onLeave);
    };
  }, []);

  const send = (text: string) => {
    const clean = text.trim();
    const userId = nextId.current++;
    const r = reply(clean, { now: new Date(), gamesVisible: panelRef.current === 'games' });
    const replyId = nextId.current++;
    setMessages((m) => [...m.slice(-60), { id: userId, from: 'user', text: clean }]);
    window.setTimeout(() => {
      setMessages((m) => [...m.slice(-60), { id: replyId, from: 'laila', text: r.text }]);
      if (r.action) {
        if (r.action === 'leave') setChatOpen(false);
        if (r.action === 'briefing') void runBriefing();
        else apiRef.current?.act(r.action);
      }
    }, 450);
  };

  return (
    <div data-laila-root className={cx('pointer-events-none absolute inset-0 z-30 overflow-hidden', gameHidden && 'invisible')}>
      <div ref={wrapRef} className="absolute top-0 left-0" style={{ width: W, height: H, willChange: 'transform' }}>
        <img
          ref={imgRef}
          alt={t('laila.name')}
          title={t('laila.poke')}
          draggable={false}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerLeave={onCancel}
          onPointerCancel={onCancel}
          width={W}
          height={H}
          className="pointer-events-auto cursor-pointer select-none"
          style={{ width: W, height: H, imageRendering: 'pixelated' }}
        />
      </div>
      {bubble !== null && (
        <div
          ref={bubbleRef}
          className={cx('glass absolute max-w-[220px] rounded-2xl px-3 py-2 text-sm', bubbleAction ? 'pointer-events-auto' : 'pointer-events-none')}
          style={{ left: 0, top: 0 }}
        >
          {bubble}
          {bubbleAction && (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => reminderOk(bubbleAction)} className="bg-accent-gradient rounded-lg px-2.5 py-1 text-xs font-medium text-white">
                {t('laila.reminderOk')}
              </button>
              <button
                type="button"
                onClick={() => reminderLater(bubbleAction)}
                className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg shadow-[inset_0_0_0_1px_var(--glass-edge)] hover:bg-surface-3"
              >
                {t('laila.reminderSnooze')}
              </button>
            </div>
          )}
        </div>
      )}
      {chatOpen && <LailaChat messages={messages} bottom={chatBottom} bond={bond} needs={needs} onFeed={feedSnack} onSend={send} onPickOutfit={pickOutfit} onClose={() => setChatOpen(false)} />}
    </div>
  );
}
