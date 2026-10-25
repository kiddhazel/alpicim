import { normalizeText } from '../palette/palette';

/**
 * Not defteri: çoklu not, sabitleme, renk etiketi. `alpicim.json` → "notebook" anahtarında saklanır.
 * Saf işlevler (birim testli); bileşenler yalnızca bunları çağırır.
 */

export const NOTEBOOK_KEY = 'notebook';
/** Başka bir yerden (palet, widget, pano) not panelini yönlendirmek için tek seferlik istek. */
export const NOTEBOOK_REQUEST_KEY = 'notebook.request';

export const MAX_NOTES = 500;
export const MAX_BODY = 50_000;

export type NoteColor = 'none' | 'violet' | 'cyan' | 'green' | 'amber' | 'rose';
export const NOTE_COLORS: readonly NoteColor[] = ['none', 'violet', 'cyan', 'green', 'amber', 'rose'];

/** Renk etiketinin CSS rengi (tema belirteçleri; "none" → renksiz). */
export const NOTE_HUE: Record<NoteColor, string | null> = {
  none: null,
  violet: 'var(--accent)',
  cyan: 'var(--accent-2)',
  green: 'var(--up)',
  amber: 'var(--warn)',
  rose: 'var(--down)',
};

export interface Note {
  id: string;
  body: string;
  color: NoteColor;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Notebook {
  notes: Note[];
}

export interface NotebookRequest {
  action: 'new' | 'open';
  id?: string;
  at: number;
}

export const EMPTY_NOTEBOOK: Notebook = { notes: [] };

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function time(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback;
}

export function sanitizeNotebook(raw: unknown): Notebook {
  if (!isObj(raw) || !Array.isArray(raw.notes)) return { notes: [] };
  const seen = new Set<string>();
  const notes: Note[] = [];
  for (const n of raw.notes.slice(0, MAX_NOTES)) {
    if (!isObj(n) || typeof n.id !== 'string' || !n.id || n.id.length > 64 || seen.has(n.id)) continue;
    if (typeof n.body !== 'string') continue;
    seen.add(n.id);
    const createdAt = time(n.createdAt, 1);
    notes.push({
      id: n.id,
      body: n.body.slice(0, MAX_BODY),
      color: NOTE_COLORS.includes(n.color as NoteColor) ? (n.color as NoteColor) : 'none',
      pinned: n.pinned === true,
      createdAt,
      updatedAt: time(n.updatedAt, createdAt),
    });
  }
  return { notes };
}

export function sanitizeRequest(raw: unknown): NotebookRequest | null {
  if (!isObj(raw) || (raw.action !== 'new' && raw.action !== 'open') || typeof raw.at !== 'number') return null;
  return { action: raw.action, id: typeof raw.id === 'string' ? raw.id : undefined, at: raw.at };
}

export function newNoteId(now = Date.now()): string {
  return `n${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Yeni notu başa ekler. Sınır doluysa en eski sabitlenmemiş not düşer. */
export function addNote(notebook: Notebook, body = '', now = Date.now(), id = newNoteId(now)): { notebook: Notebook; note: Note } {
  const note: Note = { id, body: body.slice(0, MAX_BODY), color: 'none', pinned: false, createdAt: now, updatedAt: now };
  let notes = [note, ...notebook.notes];
  if (notes.length > MAX_NOTES) {
    const oldest = [...notes].reverse().find((n) => !n.pinned && n.id !== id);
    notes = oldest ? notes.filter((n) => n.id !== oldest.id) : notes.slice(0, MAX_NOTES);
  }
  return { notebook: { notes }, note };
}

function patch(notebook: Notebook, id: string, f: (n: Note) => Note): Notebook {
  return { notes: notebook.notes.map((n) => (n.id === id ? f(n) : n)) };
}

export function setBody(notebook: Notebook, id: string, body: string, now = Date.now()): Notebook {
  return patch(notebook, id, (n) => (n.body === body ? n : { ...n, body: body.slice(0, MAX_BODY), updatedAt: now }));
}

export function togglePin(notebook: Notebook, id: string): Notebook {
  return patch(notebook, id, (n) => ({ ...n, pinned: !n.pinned }));
}

export function setColor(notebook: Notebook, id: string, color: NoteColor): Notebook {
  return patch(notebook, id, (n) => ({ ...n, color }));
}

export function removeNote(notebook: Notebook, id: string): Notebook {
  return { notes: notebook.notes.filter((n) => n.id !== id) };
}

/** Sabitlenenler önce, sonra son düzenlenen. */
export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
}

/** Satırın Markdown işaretlerini (başlık, liste, görev kutusu, alıntı) atar. */
function stripMarks(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '')
    .replace(/[*_`]/g, '')
    .trim();
}

/** Başlık: ilk dolu satır (işaretsiz, en çok 80 karakter); not boşsa boş metin. */
export function noteTitle(note: Pick<Note, 'body'>): string {
  for (const line of note.body.split('\n')) {
    const clean = stripMarks(line);
    if (clean) return clean.slice(0, 80);
  }
  return '';
}

/** Önizleme: başlıktan sonraki satırlar, tek satıra indirgenmiş (en çok 140 karakter). */
export function notePreview(note: Pick<Note, 'body'>): string {
  const lines = note.body.split('\n').map(stripMarks).filter(Boolean);
  return lines.slice(1).join(' · ').slice(0, 140);
}

export function wordCount(body: string): number {
  const m = body.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Tüm sözcükleri içeren notlar (Türkçe aksan/büyük-küçük harf duyarsız). */
export function searchNotes(notes: readonly Note[], query: string): Note[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...notes];
  return notes.filter((n) => {
    const hay = normalizeText(n.body);
    return words.every((w) => hay.includes(w));
  });
}

const TASK_RE = /^(\s*[-*+]\s+\[)([ xX])(\].*)$/;

/** `line` numaralı satırdaki görev kutusunu işaretler/kaldırır; satır görev değilse metin aynen döner. */
export function toggleTask(body: string, line: number): string {
  const lines = body.split('\n');
  const current = lines[line];
  if (current === undefined) return body;
  const m = TASK_RE.exec(current);
  if (!m) return body;
  lines[line] = `${m[1]}${m[2] === ' ' ? 'x' : ' '}${m[3]}`;
  return lines.join('\n');
}

/** Görev sayısı: [tamamlanan, toplam]. */
export function taskProgress(body: string): [number, number] {
  let done = 0;
  let total = 0;
  for (const line of body.split('\n')) {
    const m = TASK_RE.exec(line);
    if (!m) continue;
    total++;
    if (m[2] !== ' ') done++;
  }
  return [done, total];
}
