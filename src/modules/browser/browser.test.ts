import { describe, expect, it } from 'vitest';
import { hostOf, sanitizeBookmarks, toUrl } from './browserService';
import { DEFAULT_MAIN_LAYOUT, swapPanels } from '../window-manager/mainLayout';

describe('toUrl', () => {
  it('tam adresleri olduğu gibi bırakır', () => {
    expect(toUrl('https://github.com/x')).toBe('https://github.com/x');
    expect(toUrl('http://localhost:1420')).toBe('http://localhost:1420');
  });
  it('alan adına https ekler', () => {
    expect(toUrl('youtube.com')).toBe('https://youtube.com');
    expect(toUrl('tr.wikipedia.org/wiki/Ankara')).toBe('https://tr.wikipedia.org/wiki/Ankara');
  });
  it('diğer her şeyi Google’da arar', () => {
    expect(toUrl('dolar kaç tl')).toBe('https://www.google.com/search?q=dolar%20ka%C3%A7%20tl');
    expect(toUrl('tauri')).toBe('https://www.google.com/search?q=tauri');
  });
});

describe('yer imleri', () => {
  it('yalnızca web adreslerini kabul eder', () => {
    const list = sanitizeBookmarks([{ url: 'https://a.com', title: '' }, { url: 'file:///c:/x' }, 5]);
    expect(list).toEqual([{ url: 'https://a.com', title: 'a.com' }]);
    expect(hostOf('https://www.youtube.com/watch')).toBe('youtube.com');
  });
});

describe('swapPanels', () => {
  it('iki panelin yerini değiştirir', () => {
    const l = swapPanels(DEFAULT_MAIN_LAYOUT, 'news', 'launcher');
    expect(l.docked).toEqual(['launcher', 'markets', 'news']);
  });
  it('düzende olmayan panelde değişiklik yapmaz', () => {
    expect(swapPanels(DEFAULT_MAIN_LAYOUT, 'news', 'browser')).toBe(DEFAULT_MAIN_LAYOUT);
  });
});
