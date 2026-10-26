import { t, type MessageKey } from '../../i18n';

/** Laila'nın davranış ve konuşma kuralları (saf; ağ veya ücretli yapay zekâ yok — yalnız hazır cümleler). */

export type Chattiness = 'quiet' | 'normal' | 'chatty';
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';
export type Behavior = 'walk' | 'idle' | 'wave' | 'peek' | 'leave' | 'sleep' | 'play' | 'dance';
export type ReplyAction = 'wave' | 'peek' | 'leave' | 'sleep' | 'happy' | 'play' | 'briefing';

export interface Reply {
  text: string;
  action?: ReplyAction;
}

type Rng = () => number;

export function dayPart(hour: number): DayPart {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

export function pick<T>(items: readonly T[], rng: Rng = Math.random): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** tr.ts'de cümle listeleri satır satır tek metin olarak tutulur. */
export function linesOf(key: MessageKey): string[] {
  return t(key)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function line(key: MessageKey, rng: Rng = Math.random): string {
  return pick(linesOf(key), rng) ?? '';
}

export function greetingKey(part: DayPart): MessageKey {
  return `laila.greet.${part}`;
}

const PANEL_KEYS: Record<string, MessageKey> = {
  news: 'laila.panel.news',
  markets: 'laila.panel.markets',
  music: 'laila.panel.music',
  browser: 'laila.panel.browser',
  apps: 'laila.panel.apps',
  notes: 'laila.panel.notes',
  home: 'laila.panel.home',
};

/** Kendiliğinden söylenecek cümle: bazen açık panele, bazen saate göre. */
export function idleLine(ctx: { hour: number; panel?: string | null }, rng: Rng = Math.random): string {
  const roll = rng();
  const panelKey = ctx.panel ? PANEL_KEYS[ctx.panel] : undefined;
  if (panelKey && roll < 0.35) return line(panelKey, rng);
  if (dayPart(ctx.hour) === 'night' && roll < 0.55) return line('laila.lines.night', rng);
  return line('laila.lines.idle', rng);
}

/** Bir sonraki kendiliğinden konuşmaya kadar bekleme (ms); sessizde hiç konuşmaz. */
export function talkDelayMs(c: Chattiness, rng: Rng = Math.random): number | null {
  if (c === 'quiet') return null;
  const [min, max] = c === 'chatty' ? [25_000, 60_000] : [60_000, 150_000];
  return Math.round(min + rng() * (max - min));
}

export function nextBehavior(
  opts: { canPeek: boolean; canLeave: boolean; hour: number; canPlay?: boolean; waveBoost?: boolean; canDance?: boolean; sleepy?: boolean },
  rng: Rng = Math.random,
): Behavior {
  const night = dayPart(opts.hour) === 'night';
  const table: [Behavior, number][] = [
    ['walk', 5],
    ['idle', 3],
    ['wave', opts.waveBoost ? 3 : 1],
    ['play', opts.canPlay ? 2 : 0],
    ['peek', opts.canPeek ? 1.2 : 0],
    ['leave', opts.canLeave ? 0.6 : 0],
    ['dance', opts.canDance ? 2.5 : 0],
    ['sleep', opts.sleepy ? 4 : night ? 1.5 : 0.2],
  ];
  const total = table.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [behavior, weight] of table) {
    roll -= weight;
    if (roll < 0) return behavior;
  }
  return 'walk';
}

const has = (text: string, words: readonly string[]) => words.some((w) => text.includes(w));

/** Sohbet yanıtı: anahtar kelimelere göre hazır cümle (+ isteğe bağlı hareket). */
export function reply(input: string, ctx: { now: Date; gamesVisible?: boolean }, rng: Rng = Math.random): Reply {
  const text = input.toLocaleLowerCase('tr').trim();
  if (!text) return { text: line('laila.chat.empty', rng) };

  if (has(text, ['özet', 'ozet', 'bugün ne var'])) return { text: line('laila.chat.briefing', rng), action: 'briefing' };
  if (has(text, ['oyna', 'oyun'])) {
    return ctx.gamesVisible ? { text: line('laila.chat.play', rng), action: 'play' } : { text: line('laila.chat.playHint', rng) };
  }
  if (has(text, ['dışarı', 'disari', 'gez', 'yürüyüş'])) return { text: line('laila.chat.leave', rng), action: 'leave' };
  if (has(text, ['saklan', 'gizlen', 'saklambaç'])) return { text: line('laila.chat.hide', rng), action: 'peek' };
  if (has(text, ['uyu', 'uyku', 'iyi geceler'])) return { text: line('laila.chat.sleep', rng), action: 'sleep' };
  if (has(text, ['saat', 'kaç oldu'])) {
    const time = ctx.now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return { text: t('laila.chat.time', { time }) };
  }
  if (has(text, ['selam', 'merhaba', 'hey', 'sa ', 'günaydın', 'naber'])) {
    return { text: line(greetingKey(dayPart(ctx.now.getHours())), rng), action: 'wave' };
  }
  if (has(text, ['nasılsın', 'nasilsin', 'iyi misin'])) return { text: line('laila.chat.howAreYou', rng), action: 'happy' };
  if (has(text, ['kimsin', 'adın', 'adin', 'ismin'])) return { text: line('laila.chat.who', rng), action: 'wave' };
  if (has(text, ['şaka', 'fıkra', 'güldür', 'espri'])) return { text: line('laila.chat.joke', rng), action: 'happy' };
  if (has(text, ['seviyorum', 'tatlı', 'güzel', 'şirin'])) return { text: line('laila.chat.love', rng), action: 'happy' };
  if (has(text, ['teşekkür', 'sağ ol', 'sağol', 'eyvallah'])) return { text: line('laila.chat.thanks', rng), action: 'happy' };
  if (has(text, ['müzik', 'şarkı'])) return { text: line('laila.chat.music', rng) };
  if (has(text, ['hava', 'yağmur', 'güneş'])) return { text: line('laila.chat.weather', rng) };
  if (has(text, ['haber', 'gündem'])) return { text: line('laila.chat.news', rng) };
  if (has(text, ['dolar', 'euro', 'altın', 'borsa', 'kur'])) return { text: line('laila.chat.markets', rng) };
  if (has(text, ['sıkıldım', 'canım sıkıl', 'yorgun'])) return { text: line('laila.chat.bored', rng), action: 'wave' };
  if (has(text, ['görüşürüz', 'bay', 'hoşça kal'])) return { text: line('laila.chat.bye', rng), action: 'wave' };
  return { text: line('laila.chat.fallback', rng) };
}
