import { useEffect, useRef, useState, type RefObject } from 'react';
import { t } from '../../i18n';
import { setOverlay } from '../../shared/lib/overlay';
import { isTauri } from '../../shared/lib/tauri';
import { subscribe } from '../display/displayService';
import { useSettings } from '../settings/settings';
import { dayPart, greetingKey, idleLine, line, nextBehavior, reply, talkDelayMs, type Behavior, type ReplyAction } from './brain';
import { LailaChat, type ChatMessage } from './LailaChat';
import { LAILA_CHAT_EVENT, LAILA_LEAVE_EVENT } from './lailaEvents';
import { LAILA_RETURN_EVENT, lailaService } from './lailaService';
import { frameUrls, SPRITE_H, SPRITE_W, type FrameId } from './sprite';

const SCALE = 3;
const W = SPRITE_W * SCALE;
const H = SPRITE_H * SCALE;
const SPEED = 45;
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
}

interface Api {
  poke: () => void;
  act: (action: ReplyAction) => void;
  leave: () => void;
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

  chatOpenRef.current = chatOpen;
  useEffect(() => {
    setOverlay('laila-chat', chatOpen);
    return () => setOverlay('laila-chat', false);
  }, [chatOpen]);

  const say = (text: string, ms = BUBBLE_MS) => {
    window.clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
  };
  const sayRef = useRef(say);
  sayRef.current = say;
  useEffect(() => () => window.clearTimeout(bubbleTimer.current), []);

  // Hareket motoru.
  useEffect(() => {
    const host = hostRef.current;
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!host || !wrap || !img) return;
    const urls = frameUrls();
    const speak = (text: string, ms?: number) => sayRef.current(text, ms);

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
    let shownFacing = 0;
    let beh: Beh = { kind: 'idle', t0: last, dur: 1500, tx: x, happyOnly: false, px: 0, py: 0, holdMs: 0, spoke: false };

    const measure = (now: number) => {
      hostW = host.clientWidth;
      hostH = host.clientHeight;
      if (floorAt && now - floorAt < 400) return;
      floorAt = now;
      const footer = host.querySelector(':scope > footer');
      if (footer) floor = footer.getBoundingClientRect().top - host.getBoundingClientRect().top - H + 4;
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
      beh = { kind, t0: now, dur: 0, tx: x, happyOnly: opts.happyOnly ?? false, px: 0, py: 0, holdMs: 0, spoke: false };
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
        case 'leave':
          lastLeave = now;
          facing = 1;
          beh.tx = hostW + 4;
          speak(line('laila.lines.outside'));
          break;
      }
    };

    const pickNext = () => {
      if (chatOpenRef.current) {
        start('idle');
        return;
      }
      start(nextBehavior({ canPeek: findCards().length > 0, canLeave: canLeave(), hour: new Date().getHours() }));
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
          frame = (now - beh.t0) % 3000 >= 2850 ? 'blink' : 'stand';
          if (now - beh.t0 >= beh.dur) pickNext();
          break;
        case 'wave':
          frame = beh.happyOnly || Math.floor((now - beh.t0) / 400) % 2 === 1 ? 'happy' : 'wave';
          if (now - beh.t0 >= beh.dur) pickNext();
          break;
        case 'sleep':
          frame = 'sleep';
          if (now - beh.t0 >= beh.dur) pickNext();
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
      if (frame !== shownFrame) {
        shownFrame = frame;
        img.src = urls[frame];
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

    const greet = window.setTimeout(() => speak(line(greetingKey(dayPart(new Date().getHours())))), 2000);

    apiRef.current = {
      poke: () => {
        if (away || beh.kind === 'peek' || beh.kind === 'leave') return;
        start('wave');
        speak(line('laila.lines.poke'));
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
        // Sohbetten açıkça istenince bekleme süresi aranmaz.
        else if (action === 'leave' && settingsRef.current.lailaDesktop && isTauri() && !away) start('leave');
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(greet);
      off();
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
        if (!chatOpenRef.current) sayRef.current(idleLine({ hour: new Date().getHours(), panel: panelRef.current }));
        schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [chatty]);

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
    const r = reply(clean, { now: new Date() });
    const replyId = nextId.current++;
    setMessages((m) => [...m.slice(-60), { id: userId, from: 'user', text: clean }]);
    window.setTimeout(() => {
      setMessages((m) => [...m.slice(-60), { id: replyId, from: 'laila', text: r.text }]);
      if (r.action) {
        if (r.action === 'leave') setChatOpen(false);
        apiRef.current?.act(r.action);
      }
    }, 450);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <div ref={wrapRef} className="absolute top-0 left-0" style={{ width: W, height: H, willChange: 'transform' }}>
        <img
          ref={imgRef}
          alt={t('laila.name')}
          title={t('laila.poke')}
          draggable={false}
          onClick={toggleChat}
          width={W}
          height={H}
          className="pointer-events-auto cursor-pointer select-none"
          style={{ width: W, height: H, imageRendering: 'pixelated' }}
        />
      </div>
      {bubble !== null && (
        <div
          ref={bubbleRef}
          className="glass pointer-events-none absolute max-w-[220px] rounded-2xl px-3 py-2 text-sm"
          style={{ left: 0, top: 0 }}
        >
          {bubble}
        </div>
      )}
      {chatOpen && <LailaChat messages={messages} bottom={chatBottom} onSend={send} onClose={() => setChatOpen(false)} />}
    </div>
  );
}
