import { readKey, writeKey } from '../../shared/lib/store';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { BROWSER_KEYS } from '../browser/browserService';
import type { PanelId } from '../window-manager/panels';
import {
  addNote,
  EMPTY_NOTEBOOK,
  NOTEBOOK_KEY,
  NOTEBOOK_REQUEST_KEY,
  sanitizeNotebook,
  type Note,
  type Notebook,
  type NotebookRequest,
} from './notebook';

/** Not defteri durumu (tüm pencerelerde eşitlenir). */
export function useNotebook() {
  return usePersistentState<Notebook>(NOTEBOOK_KEY, EMPTY_NOTEBOOK, sanitizeNotebook);
}

/** Not paneline "yeni not" / "şu notu aç" isteği bırakır (panel açılınca veya açıksa hemen işlenir). */
export async function requestNotebook(req: Omit<NotebookRequest, 'at'>): Promise<void> {
  await writeKey<NotebookRequest>(NOTEBOOK_REQUEST_KEY, { ...req, at: Date.now() });
}

/** Metni yeni not olarak doğrudan depoya ekler (widget'lar, pano geçmişi). */
export async function captureNote(body: string): Promise<Note | null> {
  const text = body.trim();
  if (!text) return null;
  const current = sanitizeNotebook(await readKey<unknown>(NOTEBOOK_KEY, null));
  const { notebook, note } = addNote(current, text);
  await writeKey(NOTEBOOK_KEY, notebook);
  return note;
}

/** Adresi uygulama içi tarayıcı sekmesinde açar (Shell/WidgetBoard ile aynı istek anahtarı). */
export function openInAppBrowser(url: string, openPanel: (p: PanelId) => void): void {
  void writeKey(BROWSER_KEYS.lastUrl, url);
  void writeKey(BROWSER_KEYS.request, { url, at: Date.now() });
  openPanel('browser');
}
