import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';
import { onKeyChanged, readKey, writeKey } from '../../shared/lib/store';
import { isTauri } from '../../shared/lib/tauri';
import { describeError } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { BROWSER_KEYS, browserService, hostOf, isFreshRequest, toUrl, type BrowserAction, type Bounds } from './browserService';
import {
  activateTab,
  clampRatio,
  closeTab,
  createTab,
  cycleTab,
  focusedTabId,
  focusPane,
  initialTabs,
  MAX_TABS,
  paneOf,
  reorderTab,
  sanitizeTabs,
  setSplit,
  tabById,
  updateTab,
  visibleTabIds,
  type PaneIndex,
  type SplitMode,
  type TabsState,
} from './tabs';

export interface TabRuntime {
  /** Yerel webview oluşturuldu mu? */
  opened: boolean;
  loading: boolean;
  /** Webview açılamadı; kullanıcı yeniden denemeli. */
  failed: boolean;
}

const IDLE: TabRuntime = { opened: false, loading: false, failed: false };
const HIDDEN: Bounds = { x: 0, y: 0, width: 0, height: 0 };
const PERSIST_DELAY = 400;

/** Aynı pencerede panel yeniden bağlanınca palet isteği iki kez işlenmesin. */
let lastHandledRequest = 0;

/**
 * Tarayıcı sekmelerinin durumu ve yerel webview yaşam döngüsü.
 * Webview'ler tembel açılır: yalnız ekranda görünen ve adresi olan sekme için `browser_open` çağrılır.
 * `suspended` true iken (menü/diyalog katmanı, ayırıcı sürükleme) tüm webview'ler gizli kalır.
 */
export function useBrowserTabs(suspended: boolean) {
  const toast = useToast();
  const [state, setState] = useState<TabsState>(() => initialTabs());
  const [ready, setReady] = useState(false);
  const [runtime, setRuntime] = useState<Record<string, TabRuntime>>({});

  const stateRef = useRef(state);
  const readyRef = useRef(false);
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;
  const opened = useRef(new Set<string>());
  const opening = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const pendingNav = useRef(new Map<string, string>());
  const bounds = useRef(new Map<string, Bounds>());
  const persistTimer = useRef(0);

  const patchRuntime = useCallback((id: string, patch: Partial<TabRuntime>) => {
    setRuntime((r) => ({ ...r, [id]: { ...(r[id] ?? IDLE), ...patch } }));
  }, []);

  const persistNow = useCallback(() => {
    window.clearTimeout(persistTimer.current);
    persistTimer.current = 0;
    if (readyRef.current) void writeKey(BROWSER_KEYS.tabs, stateRef.current);
  }, []);

  /** Durumu değiştirir; kaldırılan sekmelerin yerel webview'ini kapatır ve gecikmeli kaydeder. */
  const update = useCallback(
    (fn: (s: TabsState) => TabsState) => {
      const prev = stateRef.current;
      const next = fn(prev);
      if (next === prev) return;
      stateRef.current = next;
      setState(next);
      for (const tab of prev.tabs) {
        if (next.tabs.some((x) => x.id === tab.id)) continue;
        if (opened.current.delete(tab.id)) void browserService.close(tab.id).catch(() => {});
        failed.current.delete(tab.id);
        pendingNav.current.delete(tab.id);
        bounds.current.delete(tab.id);
        setRuntime((r) => {
          const rest = { ...r };
          delete rest[tab.id];
          return rest;
        });
      }
      window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(persistNow, PERSIST_DELAY);
    },
    [persistNow],
  );

  const shouldShow = (id: string) => {
    const s = stateRef.current;
    const tab = tabById(s, id);
    return !!tab && tab.url !== '' && !suspendedRef.current && visibleTabIds(s).includes(id);
  };

  const openNative = useCallback(
    (id: string, url: string, b: Bounds) => {
      opening.current.add(id);
      patchRuntime(id, { loading: true, failed: false });
      browserService
        .open(id, url, b)
        .then(() => {
          opened.current.add(id);
          patchRuntime(id, { opened: true });
          if (!tabById(stateRef.current, id)) {
            // Açılırken sekme kapatıldı.
            opened.current.delete(id);
            void browserService.close(id).catch(() => {});
            return;
          }
          const next = pendingNav.current.get(id);
          pendingNav.current.delete(id);
          if (next && next !== url) void browserService.navigate(id, next).catch(() => {});
          void browserService.setBounds(id, bounds.current.get(id) ?? b, shouldShow(id)).catch(() => {});
        })
        .catch((err: unknown) => {
          failed.current.add(id);
          patchRuntime(id, { loading: false, failed: true });
          toast.push('error', describeError(err).description);
        })
        .finally(() => opening.current.delete(id));
    },
    [patchRuntime, toast],
  );

  /** Bir bölme kendi alanını ölçünce çağırır: sekmeyi gerekiyorsa açar, konumlar, gösterir/gizler. */
  const place = useCallback(
    (id: string, b: Bounds) => {
      bounds.current.set(id, b);
      const tab = tabById(stateRef.current, id);
      if (!tab) return;
      const show = shouldShow(id) && b.width >= 2 && b.height >= 2;
      if (opened.current.has(id)) {
        void browserService.setBounds(id, b, show).catch(() => {});
      } else if (show && !opening.current.has(id) && !failed.current.has(id)) {
        openNative(id, tab.url, b);
      }
    },
    [openNative],
  );

  // Ekrandan çıkan (başka sekmeye geçilen) webview'leri gizle.
  const visibleKey = visibleTabIds(state).join('|');
  useEffect(() => {
    const shown = new Set(visibleKey.split('|'));
    for (const id of opened.current) {
      if (!shown.has(id)) void browserService.setBounds(id, HIDDEN, false).catch(() => {});
    }
  }, [visibleKey]);

  /** Odaklı (ya da verilen) sekmede adres açar. */
  const go = useCallback(
    (raw: string, tabId?: string) => {
      const id = tabId ?? focusedTabId(stateRef.current);
      const url = toUrl(raw);
      update((s) => updateTab(s, id, { url, title: hostOf(url) }));
      patchRuntime(id, { loading: true });
      if (failed.current.delete(id)) patchRuntime(id, { failed: false });
      if (opened.current.has(id)) {
        void browserService.navigate(id, url).catch((err: unknown) => {
          patchRuntime(id, { loading: false });
          toast.push('error', describeError(err).description);
        });
      } else if (opening.current.has(id)) {
        pendingNav.current.set(id, url);
      } else {
        const b = bounds.current.get(id);
        if (b) place(id, b);
        // Ölçü yoksa bölme bağlanınca `place` açar.
      }
    },
    [update, patchRuntime, place, toast],
  );

  const newTab = useCallback(
    (url = '', opts: { after?: string; pane?: PaneIndex } = {}) => {
      let created = false;
      update((s) => {
        const r = createTab(s, url ? toUrl(url) : '', { ...opts, title: url ? hostOf(toUrl(url)) : '' });
        created = r.tab !== null;
        return r.state;
      });
      if (!created) toast.push('info', t('browser.tabLimit', { n: MAX_TABS }));
      return created;
    },
    [update, toast],
  );

  /** Palet isteği: odaklı sekme boş başlangıç sayfasıysa orada, değilse yeni sekmede açar. */
  const openRequest = useCallback(
    (url: string) => {
      const s = stateRef.current;
      const current = tabById(s, focusedTabId(s));
      if (current && current.url === '') go(url, current.id);
      else newTab(url);
    },
    [go, newTab],
  );

  const close = useCallback((id: string) => update((s) => closeTab(s, id)), [update]);
  const activate = useCallback((id: string) => update((s) => activateTab(s, id)), [update]);
  const focus = useCallback((pane: PaneIndex) => update((s) => focusPane(s, pane)), [update]);
  const cycle = useCallback((dir: 1 | -1) => update((s) => cycleTab(s, dir)), [update]);
  const reorder = useCallback((id: string, index: number) => update((s) => reorderTab(s, id, index)), [update]);
  const changeSplit = useCallback(
    (mode: SplitMode) => {
      const before = stateRef.current;
      update((s) => setSplit(s, mode));
      if (mode !== 'single' && stateRef.current === before && before.split === 'single') toast.push('info', t('browser.tabLimit', { n: MAX_TABS }));
    },
    [update, toast],
  );
  const setRatio = useCallback((r: number) => update((s) => ({ ...s, ratio: clampRatio(r) })), [update]);
  const goHome = useCallback(() => {
    const id = focusedTabId(stateRef.current);
    update((s) => updateTab(s, id, { url: '', title: '' }));
    patchRuntime(id, { loading: false });
  }, [update, patchRuntime]);

  const action = useCallback(
    (a: BrowserAction) => {
      const id = focusedTabId(stateRef.current);
      if (!opened.current.has(id)) return;
      void browserService.action(id, a).catch(() => {});
    },
    [],
  );

  const retry = useCallback(
    (id: string) => {
      failed.current.delete(id);
      patchRuntime(id, { failed: false });
      const b = bounds.current.get(id);
      if (b) place(id, b);
    },
    [patchRuntime, place],
  );

  // Kayıtlı sekmeleri geri yükle; panel kaldırılınca tüm webview'leri kapat.
  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    void Promise.all([readKey<unknown>(BROWSER_KEYS.tabs, null), readKey<unknown>(BROWSER_KEYS.lastUrl, '')]).then(([raw, last]) => {
      if (!alive) return;
      let restored = sanitizeTabs(raw);
      // Sekmelerden önceki sürüm yalnız son adresi saklıyordu: ilk açılışta onu sekmeye taşı.
      if (raw === null && typeof last === 'string' && /^https?:\/\//.test(last)) {
        restored = updateTab(restored, restored.panes[0], { url: last, title: hostOf(last) });
      }
      stateRef.current = restored;
      setState(restored);
      readyRef.current = true;
      setReady(true);
      void readKey<unknown>(BROWSER_KEYS.request, null).then((req) => {
        if (alive && isFreshRequest(req) && req.at !== lastHandledRequest) {
          lastHandledRequest = req.at;
          openRequest(req.url);
        }
      });
    });
    const openedSet = opened.current;
    const openingSet = opening.current;
    return () => {
      alive = false;
      persistNow();
      readyRef.current = false;
      openedSet.clear();
      openingSet.clear();
      void browserService.closeAll().catch(() => {});
    };
    // Yalnızca bağlanırken bir kez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Komut paletinden / widget'lardan gelen "adresi aç" isteği → yeni sekme.
  useEffect(
    () =>
      onKeyChanged(BROWSER_KEYS.request, () => {
        void readKey<unknown>(BROWSER_KEYS.request, null).then((req) => {
          if (!readyRef.current || !isFreshRequest(req) || req.at === lastHandledRequest) return;
          lastHandledRequest = req.at;
          openRequest(req.url);
        });
      }),
    [openRequest],
  );

  // Sayfa olayları: adres, başlık, yükleniyor; sayfanın istediği yeni sekmeler.
  useEffect(
    () =>
      browserService.onEvent((e) => {
        const s = stateRef.current;
        const tab = tabById(s, e.tab);
        if (!tab) return;
        if (e.kind === 'newTab') {
          if (e.url) newTab(e.url, { after: e.tab, pane: paneOf(s, e.tab) ?? s.focus });
          return;
        }
        // Başlangıç sayfasındaki sekmede arka plandaki eski sayfanın olayları yok sayılır.
        if (tab.url === '') return;
        if (e.loading !== null) patchRuntime(e.tab, { loading: e.loading });
        const patch: { url?: string; title?: string } = {};
        if (e.url && /^https?:/.test(e.url) && e.url !== tab.url) patch.url = e.url;
        if (e.title !== null) patch.title = e.title.slice(0, 200);
        if (patch.url || patch.title !== undefined) update((st) => updateTab(st, e.tab, patch));
      }),
    [newTab, patchRuntime, update],
  );

  const focusedId = focusedTabId(state);
  const focusedTab = tabById(state, focusedId);
  const runtimeOf = useCallback((id: string): TabRuntime => runtime[id] ?? IDLE, [runtime]);

  return useMemo(
    () => ({
      state,
      ready,
      focusedId,
      focusedTab,
      runtimeOf,
      place,
      go,
      newTab,
      close,
      activate,
      focus,
      cycle,
      reorder,
      setSplit: changeSplit,
      setRatio,
      goHome,
      action,
      retry,
    }),
    [state, ready, focusedId, focusedTab, runtimeOf, place, go, newTab, close, activate, focus, cycle, reorder, changeSplit, setRatio, goHome, action, retry],
  );
}

export type BrowserTabsApi = ReturnType<typeof useBrowserTabs>;
