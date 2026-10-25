import { describe, expect, it } from 'vitest';
import {
  activateTab,
  closeTab,
  createTab,
  cycleTab,
  focusedTabId,
  isTabId,
  MAX_TABS,
  newTabId,
  nextAfterClose,
  reorderTab,
  sanitizeTabs,
  setSplit,
  updateTab,
  visibleTabIds,
  type TabsState,
} from './tabs';

function seq() {
  let n = 0;
  return () => ((n++ * 7919) % 1000) / 1000;
}

function state(ids: string[], extra: Partial<TabsState> = {}): TabsState {
  return {
    tabs: ids.map((id) => ({ id, url: `https://${id}.com/`, title: id })),
    panes: [ids[0]!, null],
    focus: 0,
    split: 'single',
    ratio: 0.5,
    ...extra,
  };
}

describe('sekme kimliği', () => {
  it('Rust kuralına uyar ve benzersizdir', () => {
    const id = newTabId([]);
    expect(isTabId(id)).toBe(true);
    const fixed = () => 0;
    expect(newTabId([{ id: 't000000' }], (() => {
      let i = 0;
      return () => (i++ === 0 ? fixed() : 0.5);
    })())).not.toBe('t000000');
    expect(isTabId('A1')).toBe(false);
    expect(isTabId('a'.repeat(25))).toBe(false);
  });
});

describe('createTab', () => {
  it('odaklı sekmenin sağına ekler ve etkinleştirir', () => {
    const { state: s, tab } = createTab(state(['a', 'b']), 'https://x.com/', { random: seq() });
    expect(tab).not.toBeNull();
    expect(s.tabs.map((t) => t.id)).toEqual(['a', tab!.id, 'b']);
    expect(focusedTabId(s)).toBe(tab!.id);
  });
  it('arka planda açılabilir', () => {
    const { state: s } = createTab(state(['a']), '', { activate: false, random: seq() });
    expect(focusedTabId(s)).toBe('a');
    expect(s.tabs).toHaveLength(2);
  });
  it('sınırı aşmaz', () => {
    const ids = Array.from({ length: MAX_TABS }, (_, i) => `t${i}`);
    const r = createTab(state(ids), '');
    expect(r.tab).toBeNull();
    expect(r.state.tabs).toHaveLength(MAX_TABS);
  });
  it('bölünmüş görünümde odaklı bölmeye atar', () => {
    const s0 = state(['a', 'b'], { split: 'columns', panes: ['a', 'b'], focus: 1 });
    const { state: s, tab } = createTab(s0, '', { random: seq() });
    expect(s.panes).toEqual(['a', tab!.id]);
    expect(s.focus).toBe(1);
  });
});

describe('closeTab', () => {
  it('önce sağdaki, yoksa soldaki sekmeye geçer', () => {
    expect(nextAfterClose(state(['a', 'b', 'c']).tabs, 'b', [])).toBe('c');
    expect(nextAfterClose(state(['a', 'b', 'c']).tabs, 'c', [])).toBe('b');
    expect(focusedTabId(closeTab(state(['a', 'b'], { panes: ['a', null] }), 'a'))).toBe('b');
  });
  it('görünmeyen sekmeyi kapatmak bölmeleri değiştirmez', () => {
    const s = closeTab(state(['a', 'b', 'c']), 'c');
    expect(s.panes).toEqual(['a', null]);
    expect(s.tabs.map((t) => t.id)).toEqual(['a', 'b']);
  });
  it('son sekme kapanınca boş başlangıç sekmesi açılır', () => {
    const s = closeTab(state(['a']), 'a', seq());
    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0]!.url).toBe('');
    expect(s.panes[0]).toBe(s.tabs[0]!.id);
  });
  it('bölünmüş görünümde diğer bölmedeki sekmeyi seçmez', () => {
    const s0 = state(['a', 'b', 'c'], { split: 'columns', panes: ['b', 'c'], focus: 0 });
    const s = closeTab(s0, 'b');
    expect(s.panes).toEqual(['a', 'c']);
  });
  it('yalnız iki sekme varken tekli görünüme döner', () => {
    const s0 = state(['a', 'b'], { split: 'rows', panes: ['a', 'b'], focus: 1 });
    const s = closeTab(s0, 'b');
    expect(visibleTabIds(s)).toEqual(['a']);
    expect(s.focus).toBe(0);
    const s2 = closeTab(s0, 'a');
    expect(visibleTabIds(s2)).toEqual(['b']);
  });
});

describe('activateTab / cycleTab', () => {
  it('başka bölmede görünen sekmeye tıklamak o bölmeyi odaklar', () => {
    const s0 = state(['a', 'b', 'c'], { split: 'columns', panes: ['a', 'b'], focus: 0 });
    const s = activateTab(s0, 'b');
    expect(s.panes).toEqual(['a', 'b']);
    expect(s.focus).toBe(1);
    const s2 = activateTab(s0, 'c');
    expect(s2.panes).toEqual(['c', 'b']);
  });
  it('döngüde diğer bölmedeki sekmeyi atlar', () => {
    const s0 = state(['a', 'b', 'c'], { split: 'columns', panes: ['a', 'b'], focus: 0 });
    expect(cycleTab(s0, 1).panes).toEqual(['c', 'b']);
    expect(cycleTab(state(['a', 'b', 'c']), -1).panes[0]).toBe('c');
  });
});

describe('setSplit', () => {
  it('ikinci bölmeye komşu sekmeyi koyar', () => {
    const s = setSplit(state(['a', 'b']), 'columns');
    expect(visibleTabIds(s)).toEqual(['a', 'b']);
  });
  it('tek sekme varsa yeni başlangıç sekmesi açar ve odaklar', () => {
    const s = setSplit(state(['a']), 'rows', seq());
    expect(s.tabs).toHaveLength(2);
    expect(s.panes[1]).toBe(s.tabs[1]!.id);
    expect(s.focus).toBe(1);
  });
  it('tekliye dönünce ikinci bölme hatırlanır', () => {
    const split = setSplit(state(['a', 'b', 'c']), 'columns');
    const single = setSplit(split, 'single');
    expect(visibleTabIds(single)).toEqual(['a']);
    expect(setSplit(single, 'rows').panes).toEqual(split.panes);
  });
});

describe('reorder / update', () => {
  it('sekmeyi taşır', () => {
    expect(reorderTab(state(['a', 'b', 'c']), 'a', 2).tabs.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(reorderTab(state(['a', 'b']), 'x', 0).tabs.map((t) => t.id)).toEqual(['a', 'b']);
  });
  it('değişiklik yoksa aynı nesneyi döndürür', () => {
    const s = state(['a']);
    expect(updateTab(s, 'a', { title: 'a' })).toBe(s);
    expect(updateTab(s, 'a', { title: 'b' }).tabs[0]!.title).toBe('b');
  });
});

describe('sanitizeTabs', () => {
  it('bozuk veriden başlangıç durumu üretir', () => {
    const s = sanitizeTabs(null, seq());
    expect(s.tabs).toHaveLength(1);
    expect(s.split).toBe('single');
  });
  it('geçersiz kimlikleri, adresleri ve bölmeleri temizler', () => {
    const s = sanitizeTabs({
      tabs: [
        { id: 'a', url: 'https://a.com/', title: 'A' },
        { id: 'a', url: 'https://dup.com/' },
        { id: 'B!', url: 'https://bad.com/' },
        { id: 'c', url: 'file:///c:/x', title: 5 },
      ],
      panes: ['zzz', 'a'],
      focus: 1,
      split: 'columns',
      ratio: 3,
    });
    expect(s.tabs).toEqual([
      { id: 'a', url: 'https://a.com/', title: 'A' },
      { id: 'c', url: '', title: '' },
    ]);
    expect(s.panes[0]).toBe('a');
    expect(s.panes[1]).toBeNull();
    expect(s.split).toBe('single');
    expect(s.focus).toBe(0);
    expect(s.ratio).toBe(0.8);
  });
  it('geçerli bölünmüş durumu korur', () => {
    const raw = state(['a', 'b'], { split: 'rows', panes: ['b', 'a'], focus: 1, ratio: 0.3 });
    expect(sanitizeTabs(raw)).toEqual(raw);
  });
});
