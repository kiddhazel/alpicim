import { describe, expect, it } from 'vitest';
import { addLink, linkTitle, moveLink, normalizeLinkUrl, removeLink, sanitizeLinks } from './links';

describe('links helpers', () => {
  it('normalizes http/https only', () => {
    expect(normalizeLinkUrl('example.com')).toBe('https://example.com/');
    expect(normalizeLinkUrl('http://a.org/x')).toBe('http://a.org/x');
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkUrl('merhaba dunya')).toBeNull();
    expect(normalizeLinkUrl('kelime')).toBeNull();
    expect(normalizeLinkUrl('')).toBeNull();
  });

  it('adds, removes and reorders', () => {
    let l = addLink([], ' Ben ', 'example.com');
    l = addLink(l, '', 'github.com');
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ title: 'Ben', url: 'https://example.com/' });
    expect(addLink(l, 'x', 'bad url')).toHaveLength(2);
    const [a, b] = l;
    expect(moveLink(l, b!.id, -1).map((x) => x.id)).toEqual([b!.id, a!.id]);
    expect(moveLink(l, a!.id, -1).map((x) => x.id)).toEqual([a!.id, b!.id]);
    expect(removeLink(l, a!.id)).toHaveLength(1);
    expect(linkTitle(b!)).toBe('github.com');
  });

  it('sanitizes strictly', () => {
    const out = sanitizeLinks({
      links: [
        { id: 'a', title: 'A', url: 'https://a.com/' },
        { id: 'a', title: 'dup', url: 'https://b.com/' },
        { id: 'b', title: 'js', url: 'javascript:alert(1)' },
        { id: 'c', url: 'ftp://x.com' },
        { id: 'd', title: 5, url: 'http://d.com/' },
        'x',
      ],
    });
    expect(out.links.map((l) => l.id)).toEqual(['a', 'd']);
    expect(out.links[1]?.title).toBe('');
    expect(sanitizeLinks(null).links).toEqual([]);
  });
});
