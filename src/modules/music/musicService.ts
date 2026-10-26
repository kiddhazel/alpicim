import { call } from '../../shared/lib/tauri';
import type { Bounds } from '../../shared/lib/useNativeBounds';
import { subscribe } from '../display/displayService';

export const MUSIC_HOME = 'https://music.youtube.com/';

export interface MusicEvent {
  url: string | null;
  title: string | null;
  loading: boolean | null;
}

/** Rust → music.rs. Uygulama genelinde tek YouTube Music webview'i. */
export const musicService = {
  open: (b: Bounds) => call<void>('music_open', { ...b }),
  setBounds: (b: Bounds, visible: boolean) => call<void>('music_set_bounds', { ...b, visible }),
  /** Panel kapanırken: keepPlaying → yalnızca gizle; değilse kapat (ses durur). */
  release: (keepPlaying: boolean) => call<void>('music_release', { keepPlaying }),
  close: () => call<void>('music_close'),
  isOpen: () => call<boolean>('music_is_open'),
  action: (action: 'home' | 'back' | 'reload') => call<void>('music_action', { action }),
  /** Tek webview'i resmî YouTube Music arama sayfasına götürür (gerekirse gizli oluşturur). */
  search: (query: string) => call<void>('music_search', { query }),
  setMuted:(muted: boolean) => call<void>('music_set_muted', { muted }),
  /** 0..1; YouTube Music sayfasındaki video öğesinin sesi. */
  setVolume: (volume: number) => call<void>('music_set_volume', { volume }),
  onEvent: (cb: (e: MusicEvent) => void) => subscribe<MusicEvent>('alpicim://music', cb),
};
