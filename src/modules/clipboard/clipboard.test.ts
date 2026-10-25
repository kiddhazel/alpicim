import { describe, expect, it } from 'vitest';
import { clipPreview, clipUrl, filterClips, lineCount, sanitizeSnapshot, type ClipEntry } from './clipboard';

const clip = (id: string, text: string, at: number, pinned = false): ClipEntry => ({ id, text, at, pinned });

describe('clipboard', () => {
  it('sanitizes snapshots from Rust', () => {
    expect(sanitizeSnapshot(null)).toEqual({ entries: [], paused: false, available: false });
    const s = sanitizeSnapshot({ entries: [{ id: 'a', text: 'x', at: 5 }, { id: 1 }, null], paused: true, available: true });
    expect(s).toEqual({ entries: [{ id: 'a', text: 'x', at: 5, pinned: false }], paused: true, available: true });
  });

  it('filters and groups pinned entries first, newest first', () => {
    const list = [clip('a', 'Merhaba Dünya', 1), clip('b', 'şifre değil', 3, true), clip('c', 'dunya haritası', 2)];
    const all = filterClips(list, '');
    expect(all.pinned.map((c) => c.id)).toEqual(['b']);
    expect(all.recent.map((c) => c.id)).toEqual(['c', 'a']);
    expect(filterClips(list, 'DÜNYA').recent.map((c) => c.id)).toEqual(['c', 'a']);
    expect(filterClips(list, 'sifre').pinned).toHaveLength(1);
  });

  it('builds previews and detects urls', () => {
    expect(clipPreview('  bir\n\n  iki\tüç ')).toBe('bir iki üç');
    expect(clipPreview('abcdef', 4)).toBe('abc…');
    expect(lineCount('a\nb\r\nc')).toBe(3);
    expect(clipUrl(' https://ornek.com/a?b=1 ')).toBe('https://ornek.com/a?b=1');
    expect(clipUrl('bak: https://ornek.com')).toBeNull();
    expect(clipUrl('javascript:alert(1)')).toBeNull();
  });
});
