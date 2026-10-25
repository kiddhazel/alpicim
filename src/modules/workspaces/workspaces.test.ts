import { describe, expect, it } from 'vitest';
import { formatAccelerator } from '../display/displayService';
import { advance, initialState, pause, remaining, start } from '../widgets/basic/pomodoro';
import { addTodo } from '../widgets/basic/TodoWidget';
import { parseForecast, parseGeocoding, weatherLabelKey } from '../widgets/weather/weatherService';
import { dockPanel, promote, sanitizeMainLayout, setSecondary, undockPanel } from '../window-manager/mainLayout';
import {
  activeWorkspace,
  createWorkspace,
  defaultStore,
  removeWorkspace,
  resetActive,
  sanitizeWorkspaces,
  updateActive,
} from './workspaces';

describe('çalışma alanları', () => {
  it('bozuk veride hazır çalışma alanlarına döner', () => {
    expect(sanitizeWorkspaces(null).items.map((w) => w.id)).toEqual(['general', 'work', 'news-finance', 'music']);
    expect(sanitizeWorkspaces({ items: 'x' }).activeId).toBe('general');
  });

  it('geçersiz panel ve widget kayıtlarını ayıklar, çakışmaları onarır', () => {
    const s = sanitizeWorkspaces({
      activeId: 'a',
      startup: 'yok',
      items: [
        {
          id: 'a',
          name: '  Benim  ',
          icon: 'roket',
          layout: { preset: 'two', docked: ['news', 'bilinmeyen', 'news'], weights: { news: 99, foo: 1 } },
          widgets: [
            { id: 'w1', type: 'clock', x: 0, y: 0, w: 4, h: 2 },
            { id: 'w2', type: 'clock', x: 1, y: 0, w: 4, h: 2 },
            { id: 'w3', type: 'yok', x: 0, y: 0, w: 1, h: 1 },
          ],
        },
      ],
    });
    const ws = activeWorkspace(s);
    expect(ws.name).toBe('Benim');
    expect(ws.icon).toBe('star');
    expect(ws.layout.docked).toEqual(['news']);
    expect(ws.layout.weights).toEqual({ news: 5 });
    expect(ws.widgets.map((w) => w.id)).toEqual(['w1', 'w2']);
    expect(ws.widgets[1]?.y).toBe(2);
    expect(s.startup).toBe('last');
  });

  it('kopyalar, siler ve varsayılana döndürür', () => {
    let s = defaultStore();
    s = createWorkspace(s, 'Oyun');
    const copy = activeWorkspace(s);
    expect(copy.name).toBe('Oyun');
    expect(copy.widgets.every((w) => !w.id.startsWith('g-'))).toBe(true);
    s = removeWorkspace(s, copy.id);
    expect(s.items.some((w) => w.id === copy.id)).toBe(false);
    expect(s.activeId).toBe('general');

    s = updateActive(s, (w) => ({ ...w, widgets: [] }));
    expect(activeWorkspace(s).widgets).toHaveLength(0);
    s = resetActive(s);
    expect(activeWorkspace(s).widgets.length).toBeGreaterThan(0);
  });

  it('son çalışma alanı silinemez', () => {
    const one = { ...defaultStore(), items: defaultStore().items.slice(0, 1) };
    expect(removeWorkspace(one, 'general')).toBe(one);
  });

  it('haber, piyasa ve müzik varsayılan olarak sekme değildir', () => {
    const items = defaultStore().items;
    expect(items.map((w) => w.layout.docked)).toEqual([
      ['home', 'browser'],
      ['home', 'browser', 'apps'],
      ['home', 'news'],
      ['home', 'music'],
    ]);
    expect(items.every((w) => w.layout.secondary === null)).toBe(true);
  });
});

describe('sahne düzeni (ikincil görünüm)', () => {
  const base = sanitizeMainLayout({ docked: ['home', 'news', 'browser'], focused: 'home' });

  it('ikincili doğrular', () => {
    expect(sanitizeMainLayout({ docked: ['home', 'news'], focused: 'home', secondary: 'news' }).secondary).toBe('news');
    expect(sanitizeMainLayout({ docked: ['home', 'news'], focused: 'home', secondary: 'home' }).secondary).toBeNull();
    expect(sanitizeMainLayout({ docked: ['home'], focused: 'home', secondary: 'news' }).secondary).toBeNull();
    expect(sanitizeMainLayout({ docked: ['home'], secondary: 'yok' }).secondary).toBeNull();
  });

  it('setSecondary yalnız açık ve birincil olmayan paneli kabul eder', () => {
    expect(setSecondary(base, 'news').secondary).toBe('news');
    expect(setSecondary(base, 'home').secondary).toBeNull();
    expect(setSecondary(base, 'markets').secondary).toBeNull();
    expect(setSecondary(setSecondary(base, 'news'), null).secondary).toBeNull();
  });

  it('promote birincili değiştirir, ikincil ise boşaltır', () => {
    const split = setSecondary(base, 'news');
    expect(promote(split, 'news')).toMatchObject({ focused: 'news', secondary: null });
    expect(promote(split, 'browser')).toMatchObject({ focused: 'browser', secondary: 'news' });
    expect(promote(split, 'markets')).toBe(split);
  });

  it('undockPanel ikincili temizler ve odağı onarır', () => {
    const split = setSecondary(base, 'news');
    expect(undockPanel(split, 'news')).toMatchObject({ docked: ['home', 'browser'], secondary: null });
    const out = undockPanel(split, 'home');
    expect(out.focused).toBe('browser');
    expect(out.secondary).toBe('news');
    expect(undockPanel(setSecondary({ ...base, docked: ['home', 'news'] }, 'news'), 'home')).toMatchObject({ focused: 'news', secondary: null });
  });

  it('dockPanel ikinciyi öne alırsa ikincil boşalır', () => {
    expect(dockPanel(setSecondary(base, 'news'), 'news')).toMatchObject({ focused: 'news', secondary: null });
  });

  it('çalışma alanı kopyası ikinciyi korur', () => {
    let s = defaultStore();
    s = updateActive(s, (w) => ({ ...w, layout: { ...w.layout, secondary: 'browser' } }));
    expect(activeWorkspace(createWorkspace(s, 'x')).layout.secondary).toBe('browser');
  });
});

describe('pomodoro', () => {
  it('başlatır, duraklatır ve süre dolunca molaya geçer', () => {
    let s = initialState(25);
    s = start(s, 0);
    expect(remaining(s, 60_000)).toBe(24 * 60_000);
    s = pause(s, 60_000);
    expect(s.endsAt).toBeNull();
    expect(remaining(s, 999_999)).toBe(24 * 60_000);
    s = start(s, 100_000);
    const done = advance(s, 100_000 + 24 * 60_000, 25, 5);
    expect(done.phase).toBe('break');
    expect(done.completed).toBe(1);
    expect(done.remainingMs).toBe(5 * 60_000);
    expect(advance(done, Date.now(), 25, 5)).toBe(done);
  });
});

describe('yapılacaklar', () => {
  it('boş görev eklemez', () => {
    expect(addTodo([], '   ')).toEqual([]);
    expect(addTodo([], ' Süt al ')[0]?.text).toBe('Süt al');
  });
});

describe('hava durumu', () => {
  it('Open-Meteo yanıtını ayrıştırır', () => {
    const w = parseForecast(
      JSON.stringify({
        current: { time: '2026-10-25T10:00', temperature_2m: 17.4, apparent_temperature: 16, relative_humidity_2m: 60, wind_speed_10m: 12, weather_code: 3, is_day: 1 },
        daily: { time: ['2026-10-25', '2026-10-26'], temperature_2m_max: [19, 20], temperature_2m_min: [11, 12], weather_code: [3, 61] },
      }),
      5,
    );
    expect(w.temperature).toBe(17.4);
    expect(w.daily).toHaveLength(2);
    expect(w.fetchedAt).toBe(5);
    expect(weatherLabelKey(61)).toBe('weather.rain');
    expect(() => parseForecast('{"current":{}}')).toThrow();
    expect(() => parseForecast('html')).toThrow();
  });

  it('şehir aramasında geçersiz koordinatları atar', () => {
    const list = parseGeocoding(
      JSON.stringify({ results: [{ name: 'İstanbul', admin1: 'İstanbul', country: 'Türkiye', latitude: 41.01, longitude: 28.97 }, { name: 'X', latitude: 200, longitude: 0 }] }),
    );
    expect(list).toEqual([{ name: 'İstanbul', admin: 'İstanbul', country: 'Türkiye', lat: 41.01, lon: 28.97 }]);
    expect(parseGeocoding('{}')).toEqual([]);
  });
});

describe('kısayol kaydı', () => {
  const ev = (code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) => ({
    key: '',
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...mods,
  });
  it('klavye olayını Rust biçimine çevirir', () => {
    expect(formatAccelerator(ev('KeyF', { ctrlKey: true, altKey: true }))).toBe('Ctrl+Alt+F');
    expect(formatAccelerator(ev('Space', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+Space');
    expect(formatAccelerator(ev('F12', { metaKey: true }))).toBe('Win+F12');
    expect(formatAccelerator(ev('ControlLeft', { ctrlKey: true }))).toBeNull();
  });
});
