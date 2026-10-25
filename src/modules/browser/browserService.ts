import { listen } from '@tauri-apps/api/event';
import { call, currentWindowLabel, isTauri } from '../../shared/lib/tauri';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `alpicim://browser` olayı (Rust `browser.rs::BrowserEvent`). */
export interface BrowserEvent {
  owner: string;
  tab: string;
  /** "state": adres/başlık/yükleniyor; "newTab": sayfa yeni sekme istedi (`url`). */
  kind: 'state' | 'newTab';
  url: string | null;
  title: string | null;
  loading: boolean | null;
}

export type BrowserAction = 'back' | 'forward' | 'reload' | 'stop';

export interface Bookmark {
  title: string;
  url: string;
}

export const BROWSER_KEYS = {
  /** Son açılan adres (geriye dönük uyumluluk; sekmeler `tabs` altında saklanır). */
  lastUrl: 'browser.lastUrl',
  bookmarks: 'browser.bookmarks',
  /** Açık sekmeler + bölünmüş görünüm (`tabs.ts::TabsState`). */
  tabs: 'browser.tabs',
  /** Başka bir yerden (komut paleti) "bu adresi aç" isteği: { url, at }. */
  request: 'browser.request',
} as const;

export interface BrowserRequest {
  url: string;
  at: number;
}

export const DEFAULT_BOOKMARKS: Bookmark[] = [
  { title: 'Google', url: 'https://www.google.com/' },
  { title: 'YouTube', url: 'https://www.youtube.com/' },
  { title: 'Gmail', url: 'https://mail.google.com/' },
  { title: 'GitHub', url: 'https://github.com/' },
  { title: 'Vikipedi', url: 'https://tr.wikipedia.org/' },
  { title: 'X', url: 'https://x.com/' },
];

/**
 * Adres çubuğuna yazılanı adrese çevirir: tam adres → olduğu gibi; alan adına benzeyen → https://;
 * diğer her şey → Google araması.
 */
export function toUrl(input: string): string {
  const text = input.trim();
  if (!text) return 'https://www.google.com/';
  if (/^https?:\/\//i.test(text)) return text;
  const looksLikeHost = !/\s/.test(text) && (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(text) || /^localhost(:\d+)?(\/.*)?$/.test(text));
  if (looksLikeHost) return `https://${text}`;
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}

/** Kısa görünüm için alan adı. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function faviconUrl(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(url))}&sz=64`;
}

export function sanitizeBookmarks(raw: unknown): Bookmark[] {
  if (!Array.isArray(raw)) return [...DEFAULT_BOOKMARKS];
  return raw
    .filter((b): b is Bookmark => !!b && typeof b.url === 'string' && /^https?:\/\//.test(b.url))
    .map((b) => ({ url: b.url, title: typeof b.title === 'string' && b.title ? b.title.slice(0, 60) : hostOf(b.url) }));
}

/** Reklam engelleyici olaylarındaki webview etiketi (Rust `browser.rs::label_for`). */
export function browserWebviewLabel(windowLabel: string, tab: string): string {
  return `${windowLabel}-browser-${tab}`;
}

/** Palet/widget'lardan gelen "adresi aç" isteği hâlâ geçerli mi? */
export function isFreshRequest(req: unknown, now: number = Date.now()): req is BrowserRequest {
  if (!req || typeof req !== 'object') return false;
  const r = req as Partial<BrowserRequest>;
  return typeof r.url === 'string' && /^https?:\/\//.test(r.url) && typeof r.at === 'number' && now - r.at < 10_000 && now >= r.at - 1_000;
}

export const browserService = {
  open: (tab: string, url: string, b: Bounds) => call<void>('browser_open', { tab, url, ...b }),
  setBounds: (tab: string, b: Bounds, visible: boolean) => call<void>('browser_set_bounds', { tab, ...b, visible }),
  navigate: (tab: string, url: string) => call<void>('browser_navigate', { tab, url }),
  action: (tab: string, action: BrowserAction) => call<void>('browser_action', { tab, action }),
  close: (tab: string) => call<void>('browser_close', { tab }),
  closeAll: () => call<void>('browser_close_all'),

  /** Bu pencereye ait tarayıcı olaylarını dinler. */
  onEvent(cb: (e: BrowserEvent) => void): () => void {
    if (!isTauri()) return () => {};
    const me = currentWindowLabel();
    let off: (() => void) | null = null;
    let disposed = false;
    void listen<BrowserEvent>('alpicim://browser', (e) => {
      if (e.payload.owner === me) cb(e.payload);
    }).then((fn) => {
      if (disposed) fn();
      else off = fn;
    });
    return () => {
      disposed = true;
      off?.();
    };
  },
};
