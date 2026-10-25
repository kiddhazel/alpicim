/**
 * Tarayıcı sekmeleri ve bölünmüş görünüm için saf durum modeli (React/Tauri bağımsız, birim testli).
 *
 * - `url === ''` → sekme başlangıç sayfasını gösterir.
 * - `panes[0]` her zaman bir sekmedir; `panes[1]` yalnız bölünmüş görünümde kullanılır (tekli görünüme
 *   dönülünce hatırlanır). İki bölme aynı sekmeyi gösteremez.
 */

export type SplitMode = 'single' | 'columns' | 'rows';
export type PaneIndex = 0 | 1;

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
}

export interface TabsState {
  tabs: BrowserTab[];
  panes: [string, string | null];
  focus: PaneIndex;
  split: SplitMode;
  /** İlk bölmenin payı (0.2–0.8). */
  ratio: number;
}

export const MAX_TABS = 12;
export const MIN_RATIO = 0.2;
export const MAX_RATIO = 0.8;
const TAB_ID = /^[a-z0-9-]{1,24}$/;
const SPLITS: readonly SplitMode[] = ['single', 'columns', 'rows'];

export function isTabId(id: unknown): id is string {
  return typeof id === 'string' && TAB_ID.test(id);
}

/** Kısa, benzersiz sekme kimliği (Rust tarafında `[a-z0-9-]{1,24}` olarak doğrulanır). */
export function newTabId(taken: ReadonlyArray<{ id: string }>, random: () => number = Math.random): string {
  for (;;) {
    const id = `t${Math.floor(random() * 36 ** 6)
      .toString(36)
      .padStart(6, '0')}`;
    if (!taken.some((t) => t.id === id)) return id;
  }
}

export function clampRatio(r: number): number {
  if (!Number.isFinite(r)) return 0.5;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
}

export function initialTabs(random?: () => number): TabsState {
  const id = newTabId([], random);
  return { tabs: [{ id, url: '', title: '' }], panes: [id, null], focus: 0, split: 'single', ratio: 0.5 };
}

export function isSplit(s: TabsState): boolean {
  return s.split !== 'single' && s.panes[1] !== null;
}

/** Şu an ekranda olan sekmeler (bölme sırasıyla). */
export function visibleTabIds(s: TabsState): string[] {
  return isSplit(s) && s.panes[1] ? [s.panes[0], s.panes[1]] : [s.panes[0]];
}

export function focusedTabId(s: TabsState): string {
  return isSplit(s) && s.focus === 1 && s.panes[1] ? s.panes[1] : s.panes[0];
}

export function tabById(s: TabsState, id: string): BrowserTab | undefined {
  return s.tabs.find((t) => t.id === id);
}

/** Sekme hangi bölmede görünüyor? (görünmüyorsa null) */
export function paneOf(s: TabsState, id: string): PaneIndex | null {
  if (s.panes[0] === id) return 0;
  if (isSplit(s) && s.panes[1] === id) return 1;
  return null;
}

function withPane(s: TabsState, pane: PaneIndex, id: string): TabsState {
  const panes: [string, string | null] = pane === 0 ? [id, s.panes[1]] : [s.panes[0], id];
  // İki bölme aynı sekmeyi göstermesin: diğer bölme bu sekmeyi gösteriyorsa yer değiştir.
  const other = pane === 0 ? 1 : 0;
  if (panes[other] === id) {
    const previous = s.panes[pane];
    if (other === 1) panes[1] = previous;
    else if (previous) panes[0] = previous;
    else return { ...s, panes: [id, null] };
  }
  return { ...s, panes };
}

/** Bir bölmeyi odaklar (bölünmüş görünüm yoksa daima 0). */
export function focusPane(s: TabsState, pane: PaneIndex): TabsState {
  const next: PaneIndex = isSplit(s) ? pane : 0;
  return next === s.focus ? s : { ...s, focus: next };
}

/**
 * Sekmeyi etkinleştirir: başka bölmede zaten görünüyorsa o bölme odaklanır, değilse odaklı bölmeye atanır.
 */
export function activateTab(s: TabsState, id: string): TabsState {
  if (!tabById(s, id)) return s;
  const shown = paneOf(s, id);
  if (shown !== null) return focusPane(s, shown);
  return withPane(s, isSplit(s) ? s.focus : 0, id);
}

/**
 * Yeni sekme ekler (odaklı sekmenin ya da `after` sekmesinin hemen sağına). Sınırda ise `tab` null döner.
 * `activate` true ise sekme `pane` bölmesine (yoksa odaklı bölmeye) atanır ve o bölme odaklanır.
 */
export function createTab(
  s: TabsState,
  url: string,
  opts: { activate?: boolean; after?: string; pane?: PaneIndex; title?: string; random?: () => number } = {},
): { state: TabsState; tab: BrowserTab | null } {
  if (s.tabs.length >= MAX_TABS) return { state: s, tab: null };
  const tab: BrowserTab = { id: newTabId(s.tabs, opts.random), url, title: opts.title ?? '' };
  const anchor = opts.after ?? focusedTabId(s);
  const at = s.tabs.findIndex((t) => t.id === anchor);
  const tabs = [...s.tabs];
  tabs.splice(at < 0 ? tabs.length : at + 1, 0, tab);
  let state: TabsState = { ...s, tabs };
  if (opts.activate ?? true) {
    const pane: PaneIndex = isSplit(state) ? (opts.pane ?? state.focus) : 0;
    state = { ...withPane(state, pane, tab.id), focus: pane };
  }
  return { state, tab };
}

/** Kapanan sekmenin yerine geçecek sekme: önce sağdaki, yoksa soldaki; `exclude` dışındakilerden. */
export function nextAfterClose(tabs: ReadonlyArray<BrowserTab>, closing: string, exclude: ReadonlyArray<string | null>): string | null {
  const i = tabs.findIndex((t) => t.id === closing);
  if (i < 0) return null;
  const ok = (t: BrowserTab | undefined) => !!t && t.id !== closing && !exclude.includes(t.id);
  for (let d = 1; d < tabs.length; d++) {
    const right = tabs[i + d];
    if (ok(right)) return right!.id;
    const left = tabs[i - d];
    if (ok(left)) return left!.id;
  }
  return null;
}

/**
 * Sekmeyi kapatır. Görünen bir sekmeyse bölmesine komşu sekme gelir; uygun sekme yoksa bölünmüş görünüm
 * tekliye döner. Son sekme kapatılırsa yerine boş bir başlangıç sekmesi açılır.
 */
export function closeTab(s: TabsState, id: string, random?: () => number): TabsState {
  if (!tabById(s, id)) return s;
  if (s.tabs.length === 1) {
    const fresh = initialTabs(random);
    return { ...fresh, split: s.split, ratio: s.ratio, panes: [fresh.panes[0], null] };
  }
  const tabs = s.tabs.filter((t) => t.id !== id);
  const split = isSplit(s);
  let [p0, p1] = s.panes;
  let focus = s.focus;
  if (p0 === id) {
    const repl = nextAfterClose(s.tabs, id, split ? [p1] : []);
    if (repl) p0 = repl;
    else {
      // Yalnız diğer bölmedeki sekme kaldı: tekli görünüme dön.
      p0 = p1 ?? tabs[0]!.id;
      p1 = null;
      focus = 0;
    }
  } else if (p1 === id) {
    p1 = split ? nextAfterClose(s.tabs, id, [p0]) : null;
    if (!p1) focus = 0;
  }
  if (p1 !== null && !tabs.some((t) => t.id === p1)) p1 = null;
  const next: TabsState = { ...s, tabs, panes: [p0, p1], focus };
  return isSplit(next) ? next : { ...next, focus: 0 };
}

export function reorderTab(s: TabsState, id: string, toIndex: number): TabsState {
  const from = s.tabs.findIndex((t) => t.id === id);
  if (from < 0) return s;
  const to = Math.max(0, Math.min(s.tabs.length - 1, Math.round(toIndex)));
  if (to === from) return s;
  const tabs = [...s.tabs];
  const [moved] = tabs.splice(from, 1);
  tabs.splice(to, 0, moved!);
  return { ...s, tabs };
}

/** Odaklı bölmede sıradaki/önceki sekmeye geçer (diğer bölmedeki sekme atlanır). */
export function cycleTab(s: TabsState, dir: 1 | -1): TabsState {
  const current = focusedTabId(s);
  const other = isSplit(s) ? (s.focus === 0 ? s.panes[1] : s.panes[0]) : null;
  const n = s.tabs.length;
  const i = s.tabs.findIndex((t) => t.id === current);
  for (let d = 1; d < n; d++) {
    const cand = s.tabs[(((i + d * dir) % n) + n) % n];
    if (cand && cand.id !== other) return activateTab(s, cand.id);
  }
  return s;
}

/**
 * Görünüm düzenini değiştirir. Bölünmüş görünüme geçerken ikinci bölme için hatırlanan, komşu ya da
 * (gerekirse) yeni bir başlangıç sekmesi kullanılır; sekme sınırındaysa ve başka sekme yoksa değişmez.
 */
export function setSplit(s: TabsState, mode: SplitMode, random?: () => number): TabsState {
  if (mode === 'single') return s.split === 'single' ? s : { ...s, split: 'single', focus: 0 };
  const remembered = s.panes[1] && s.panes[1] !== s.panes[0] && tabById(s, s.panes[1]) ? s.panes[1] : null;
  const second = remembered ?? nextAfterClose(s.tabs, s.panes[0], []);
  if (second) return { ...s, split: mode, panes: [s.panes[0], second] };
  const { state, tab } = createTab({ ...s, split: mode }, '', { activate: false, random });
  if (!tab) return s;
  return { ...state, panes: [s.panes[0], tab.id], focus: 1 };
}

export function updateTab(s: TabsState, id: string, patch: Partial<Omit<BrowserTab, 'id'>>): TabsState {
  let changed = false;
  const tabs = s.tabs.map((t) => {
    if (t.id !== id) return t;
    const next = { ...t, ...patch };
    if (next.url === t.url && next.title === t.title) return t;
    changed = true;
    return next;
  });
  return changed ? { ...s, tabs } : s;
}

function cleanUrl(raw: unknown): string {
  return typeof raw === 'string' && /^https?:\/\//i.test(raw) && raw.length <= 4096 ? raw : '';
}

/** Depodan okunan (eski/bozuk) sekme durumunu güvenli biçime getirir. */
export function sanitizeTabs(raw: unknown, random?: () => number): TabsState {
  if (!raw || typeof raw !== 'object') return initialTabs(random);
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const tabs: BrowserTab[] = [];
  for (const item of Array.isArray(r.tabs) ? r.tabs : []) {
    if (tabs.length >= MAX_TABS) break;
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    if (!isTabId(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    tabs.push({ id: t.id, url: cleanUrl(t.url), title: typeof t.title === 'string' ? t.title.slice(0, 200) : '' });
  }
  if (tabs.length === 0) return initialTabs(random);
  const panesRaw = Array.isArray(r.panes) ? r.panes : [];
  const p0 = seen.has(panesRaw[0] as string) ? (panesRaw[0] as string) : tabs[0]!.id;
  const p1Raw = panesRaw[1];
  const p1 = typeof p1Raw === 'string' && seen.has(p1Raw) && p1Raw !== p0 ? p1Raw : null;
  const split = SPLITS.includes(r.split as SplitMode) ? (r.split as SplitMode) : 'single';
  const state: TabsState = {
    tabs,
    panes: [p0, p1],
    focus: r.focus === 1 ? 1 : 0,
    split: split !== 'single' && p1 === null ? 'single' : split,
    ratio: clampRatio(typeof r.ratio === 'number' ? r.ratio : 0.5),
  };
  return isSplit(state) ? state : { ...state, focus: 0 };
}
