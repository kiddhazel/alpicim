import { call, isTauri } from '../../shared/lib/tauri';
import { t } from '../../i18n';
import { subscribe } from '../display/displayService';
import { captureNote } from '../notebook/notebookService';

export const SNIP_DONE_EVENT = 'alpicim://snip-done';

/** Rust → capture.rs komutları. */
export const screenshotService = {
  /** Ekranı yakalar ve seçim penceresini açar (sonuç `SNIP_DONE_EVENT` ile gelir). */
  start: () => call<void>('snip_start'),
  finish: (r: { fx: number; fy: number; fw: number; fh: number }) => call<string>('snip_finish', r),
  cancel: () => call<void>('snip_cancel'),
  reveal: (path: string) => call<void>('snip_reveal', { path }),
  openFolder: () => call<void>('snip_open_folder'),
  /** Windows'un kendi ekran kaydedicisi (ms-screenclip). */
  openRecorder: () => call<void>('screen_record_open'),
};

export function canScreenshot(): boolean {
  return isTauri();
}

/** Dosya yolunu içeren bir satırla yeni not oluşturur. */
export async function addShotToNote(path: string): Promise<void> {
  await captureNote(t('screenshot.noteLine', { path }));
}

export function onSnipDone(cb: (path: string) => void): () => void {
  return subscribe<{ path: string }>(SNIP_DONE_EVENT, (p) => cb(p.path));
}
