import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, safeHref } from './markdown';
import {
  addNote,
  MAX_NOTES,
  noteTitle,
  notePreview,
  removeNote,
  sanitizeNotebook,
  sanitizeRequest,
  searchNotes,
  setBody,
  setColor,
  sortNotes,
  taskProgress,
  togglePin,
  toggleTask,
  wordCount,
  type Note,
} from './notebook';

const note = (id: string, body: string, extra: Partial<Note> = {}): Note => ({
  id,
  body,
  color: 'none',
  pinned: false,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});

describe('notebook', () => {
  it('sanitizes stored data and keeps valid notes', () => {
    const nb = sanitizeNotebook({
      notes: [
        { id: 'a', body: 'x', color: 'violet', pinned: true, createdAt: 5, updatedAt: 9 },
        { id: 'a', body: 'dup' },
        { id: 'b', body: 42 },
        { id: 'c', body: 'y', color: 'pink', createdAt: 'no' },
        null,
      ],
    });
    expect(nb.notes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(nb.notes[0]).toMatchObject({ color: 'violet', pinned: true, updatedAt: 9 });
    expect(nb.notes[1]).toMatchObject({ color: 'none', pinned: false });
    expect(sanitizeNotebook('bozuk')).toEqual({ notes: [] });
  });

  it('validates requests', () => {
    expect(sanitizeRequest({ action: 'new', at: 1 })).toEqual({ action: 'new', id: undefined, at: 1 });
    expect(sanitizeRequest({ action: 'open', id: 'x', at: 2 })).toEqual({ action: 'open', id: 'x', at: 2 });
    expect(sanitizeRequest({ action: 'drop', at: 1 })).toBeNull();
  });

  it('adds, edits, pins, colors and removes', () => {
    const created = addNote({ notes: [] }, 'Merhaba', 10, 'n1');
    const n = created.note;
    let notebook = created.notebook;
    expect(notebook.notes).toHaveLength(1);
    notebook = setBody(notebook, n.id, 'Merhaba dünya', 20);
    expect(notebook.notes[0]).toMatchObject({ body: 'Merhaba dünya', updatedAt: 20, createdAt: 10 });
    // Aynı içerik: zaman değişmez.
    expect(setBody(notebook, n.id, 'Merhaba dünya', 30).notes[0]?.updatedAt).toBe(20);
    notebook = togglePin(setColor(notebook, n.id, 'amber'), n.id);
    expect(notebook.notes[0]).toMatchObject({ pinned: true, color: 'amber' });
    expect(removeNote(notebook, n.id).notes).toHaveLength(0);
  });

  it('drops the oldest unpinned note when full', () => {
    const notes = Array.from({ length: MAX_NOTES }, (_, i) => note(`n${i}`, `b${i}`, { pinned: i === MAX_NOTES - 1 }));
    const { notebook } = addNote({ notes }, 'yeni', 5, 'fresh');
    expect(notebook.notes).toHaveLength(MAX_NOTES);
    expect(notebook.notes.some((n) => n.id === `n${MAX_NOTES - 1}`)).toBe(true);
    expect(notebook.notes.some((n) => n.id === `n${MAX_NOTES - 2}`)).toBe(false);
  });

  it('sorts pinned first, then newest', () => {
    const sorted = sortNotes([note('a', '', { updatedAt: 3 }), note('b', '', { updatedAt: 9 }), note('c', '', { pinned: true, updatedAt: 1 })]);
    expect(sorted.map((n) => n.id)).toEqual(['c', 'b', 'a']);
  });

  it('derives title and preview from markdown', () => {
    const n = note('a', '\n# Alışveriş\n- [ ] süt\n- [x] **ekmek**\n');
    expect(noteTitle(n)).toBe('Alışveriş');
    expect(notePreview(n)).toBe('süt · ekmek');
    expect(noteTitle(note('b', '   '))).toBe('');
    expect(wordCount('bir  iki\nüç')).toBe(3);
  });

  it('searches without case or accents', () => {
    const notes = [note('a', 'İstanbul toplantısı'), note('b', 'Ankara')];
    expect(searchNotes(notes, 'istanbul TOPLANTI').map((n) => n.id)).toEqual(['a']);
    expect(searchNotes(notes, '')).toHaveLength(2);
  });

  it('toggles task checkboxes by line', () => {
    const body = 'Başlık\n- [ ] bir\n  * [x] iki\nmetin';
    expect(toggleTask(body, 1)).toBe('Başlık\n- [x] bir\n  * [x] iki\nmetin');
    expect(toggleTask(body, 2)).toBe('Başlık\n- [ ] bir\n  * [ ] iki\nmetin');
    expect(toggleTask(body, 3)).toBe(body);
    expect(toggleTask(body, 99)).toBe(body);
    expect(taskProgress(body)).toEqual([1, 2]);
  });
});

describe('markdown', () => {
  it('only allows http(s) links', () => {
    expect(safeHref('https://ornek.com/a')).toBe('https://ornek.com/a');
    expect(safeHref('www.ornek.com')).toBe('https://www.ornek.com/');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('file:///C:/x')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
  });

  it('parses inline formatting', () => {
    expect(parseInline('a **b _c_** `d` e')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', children: [{ type: 'text', text: 'b ' }, { type: 'italic', children: [{ type: 'text', text: 'c' }] }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'd' },
      { type: 'text', text: ' e' },
    ]);
    expect(parseInline('snake_case_name')).toEqual([{ type: 'text', text: 'snake_case_name' }]);
    expect(parseInline('2 * 3 * 4')).toEqual([{ type: 'text', text: '2 * 3 * 4' }]);
  });

  it('parses links and rejects unsafe ones as text', () => {
    expect(parseInline('[site](https://a.com) ve https://b.com.')).toEqual([
      { type: 'link', text: 'site', href: 'https://a.com/' },
      { type: 'text', text: ' ve ' },
      { type: 'link', text: 'https://b.com', href: 'https://b.com/' },
      { type: 'text', text: '.' },
    ]);
    expect(parseInline('[x](javascript:alert(1))')[0]).toEqual({ type: 'text', text: '[x](javascript:alert(1)' });
  });

  it('keeps html as plain text', () => {
    const blocks = parseMarkdown('<img src=x onerror=alert(1)>');
    expect(blocks).toEqual([{ type: 'paragraph', lines: [[{ type: 'text', text: '<img src=x onerror=alert(1)>' }]] }]);
  });

  it('parses blocks with line numbers for tasks', () => {
    const blocks = parseMarkdown('# Başlık\n\n- [ ] bir\n- [x] iki\n  - alt\n1. sıra\n> alıntı\n---\n```\nkod *yok*\n```\nson');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'list', 'list', 'quote', 'hr', 'code', 'paragraph']);
    const tasks = blocks[1];
    expect(tasks?.type === 'list' && tasks.items.map((i) => [i.task, i.line, i.depth])).toEqual([
      [false, 2, 0],
      [true, 3, 0],
      [null, 4, 1],
    ]);
    const ordered = blocks[2];
    expect(ordered?.type === 'list' && ordered.ordered && ordered.start).toBe(1);
    expect(blocks[5]).toEqual({ type: 'code', text: 'kod *yok*' });
  });
});
