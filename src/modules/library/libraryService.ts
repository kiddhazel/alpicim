import { call } from '../../shared/lib/tauri';
import type { LibraryGame } from './library';

/** Oyunlar Rust tarafında taranır; başlatma yalnızca taranan listedeki kimlikle yapılır. */
export const libraryService = {
  list: () => call<LibraryGame[]>('gamelib_list'),
  scan: () => call<LibraryGame[]>('gamelib_scan'),
  launch: (id: string) => call<void>('gamelib_launch', { id }),
  icon: (id: string) => call<string | null>('gamelib_icon', { id }),
};
