import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { t } from '../../i18n';
import { useInterval } from '../../shared/lib/hooks';
import { useOverlayActive } from '../../shared/lib/overlay';
import { isTauri } from '../../shared/lib/tauri';
import { measure, useNativeBounds } from '../../shared/lib/useNativeBounds';
import { describeError } from '../../shared/ui/StateView';
import { useToast } from '../../shared/ui/Toast';
import { embedService, tabFromWindow, useAppTabs, type AppTab, type WindowInfo } from './embedService';

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Pencereler panelinin iş mantığı: sekmeler, gömme/ayırma, konum takibi ve kapanan pencerelerin algılanması.
 * Panel kaldırılırken (gizleme, çalışma alanı değişimi, pencere kapanışı) tüm pencereler bağımsız hâle getirilir;
 * panel tekrar açılınca aynı oturumdaki pencereler otomatik olarak yeniden yerleştirilir.
 */
export function useEmbeddedApps(contentRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const toast = useToast();
  const [tabs, setTabs, loaded] = useAppTabs();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [attached, setAttached] = useState<number[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  /** Penceresi açık ama bu oturumda henüz yerleştirilmemiş sekmeler (onay bekler). */
  const [idle, setIdle] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const overlay = useOverlayActive();
  const attachedRef = useRef<number[]>([]);
  attachedRef.current = attached;
  const pending = useRef(new Set<number>());

  const active = tabs.find((x) => x.id === activeId) ?? tabs[0] ?? null;

  const bounds = () => (contentRef.current ? measure(contentRef.current) : null);

  const markMissing = (id: string, on: boolean) =>
    setMissing((m) => (on ? (m.includes(id) ? m : [...m, id]) : m.filter((x) => x !== id)));

  // Kayıtlı sekmelerin pencerelerini bu panele yerleştir (aynı oturumda hâlâ açıklarsa).
  useEffect(() => {
    if (!loaded || !enabled || !isTauri()) return;
    for (const tab of tabs) {
      if (tab.mode !== 'embedded' || tab.hwnd === null) continue;
      const hwnd = tab.hwnd;
      if (attachedRef.current.includes(hwnd) || pending.current.has(hwnd)) continue;
      const b = bounds();
      if (!b) return;
      pending.current.add(hwnd);
      void (async () => {
        try {
          const info = await embedService.info(hwnd);
          // HWND başka bir pencereye ait olabilir (yeniden başlatma sonrası): exe yolu eşleşmeli.
          if (!info || !same(info.exePath, tab.exePath)) {
            markMissing(tab.id, true);
            return;
          }
          // Yeni açılışta otomatik gömme yok: kullanıcı "Panele yerleştir" ile onaylar.
          if (!(await embedService.known(hwnd))) {
            setIdle((list) => (list.includes(tab.id) ? list : [...list, tab.id]));
            return;
          }
          await embedService.attach(hwnd, b);
          setAttached((list) => (list.includes(hwnd) ? list : [...list, hwnd]));
          markMissing(tab.id, false);
        } catch (err) {
          markMissing(tab.id, true);
          toast.push('error', `${tab.title}: ${describeError(err).description}`);
        } finally {
          pending.current.delete(hwnd);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, loaded, enabled]);

  // Panel kaldırılınca veya özellik kapatılınca hepsini bağımsız hâle getir.
  useEffect(() => {
    if (enabled) return;
    for (const hwnd of attachedRef.current) void embedService.release(hwnd).catch(() => {});
    setAttached([]);
  }, [enabled]);
  useEffect(
    () => () => {
      for (const hwnd of attachedRef.current) void embedService.release(hwnd).catch(() => {});
    },
    [],
  );

  // Yalnızca etkin sekmenin penceresi görünür; menü/sürükleme katmanı açıkken hepsi gizlenir.
  useNativeBounds(
    contentRef,
    (b) => {
      for (const tab of tabs) {
        if (tab.hwnd === null || !attached.includes(tab.hwnd)) continue;
        const visible = !overlay && tab.id === active?.id;
        void embedService.setBounds(tab.hwnd, b, visible).catch(() => {});
      }
    },
    [tabs, attached, overlay, active?.id],
  );

  // Kullanıcı gömülü uygulamayı kendi içinden kapattıysa sekmeyi "kapandı" olarak işaretle.
  useInterval(
    () => {
      if (attachedRef.current.length === 0) return;
      void embedService.alive().then((alive) => {
        const gone = attachedRef.current.filter((h) => !alive.includes(h));
        if (gone.length === 0) return;
        setAttached((list) => list.filter((h) => !gone.includes(h)));
        for (const tab of tabs) if (tab.hwnd !== null && gone.includes(tab.hwnd)) markMissing(tab.id, true);
      });
    },
    enabled ? 2000 : null,
  );

  const add = useCallback(
    async (w: WindowInfo, forceCard = false) => {
      if (tabs.some((x) => x.hwnd === w.hwnd)) {
        setActiveId(tabs.find((x) => x.hwnd === w.hwnd)?.id ?? null);
        return;
      }
      const asCard = forceCard || !w.embeddable || !enabled;
      const tab = tabFromWindow(w, asCard ? 'card' : 'embedded');
      if (!asCard) {
        const b = bounds();
        if (!b) return;
        setBusy(true);
        try {
          pending.current.add(w.hwnd);
          await embedService.attach(w.hwnd, b);
          setAttached((list) => [...list, w.hwnd]);
        } catch (err) {
          toast.push('error', `${t('apps.embedFailed')}: ${describeError(err).description}`);
          return;
        } finally {
          pending.current.delete(w.hwnd);
          setBusy(false);
        }
      }
      setTabs((list) => [...list, tab]);
      setActiveId(tab.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs, enabled, setTabs, toast],
  );

  const pick = useCallback(async () => {
    setBusy(true);
    try {
      const w = await embedService.pick(15_000);
      if (!w) {
        toast.push('info', t('apps.pickTimeout'));
        return;
      }
      setBusy(false);
      await add(w);
    } catch (err) {
      toast.push('error', describeError(err).description);
    } finally {
      setBusy(false);
    }
  }, [add, toast]);

  /** Pencereyi panelden çıkarır; eski konumuna ve boyutuna döner, bağımsız kullanılabilir. */
  const detach = useCallback(
    async (tab: AppTab) => {
      if (tab.hwnd !== null && attachedRef.current.includes(tab.hwnd)) {
        try {
          await embedService.release(tab.hwnd);
        } catch (err) {
          toast.push('error', describeError(err).description);
        }
        setAttached((list) => list.filter((h) => h !== tab.hwnd));
      }
      setTabs((list) => list.filter((x) => x.id !== tab.id));
      markMissing(tab.id, false);
    },
    [setTabs, toast],
  );

  const focus = useCallback(
    (tab: AppTab) => {
      if (tab.hwnd === null) return;
      if (tab.mode === 'card' || !attachedRef.current.includes(tab.hwnd)) {
        embedService.activate(tab.hwnd).catch((err: unknown) => toast.push('error', describeError(err).description));
      } else {
        embedService.focus(tab.hwnd).catch(() => {});
      }
    },
    [toast],
  );

  /** Kapanmış/yeniden başlatılmış uygulamanın açık penceresini exe yolundan yeniden bulur. */
  const relocate = useCallback(
    async (tab: AppTab) => {
      const w = await embedService.findExe(tab.exePath).catch(() => null);
      if (!w) {
        toast.push('info', t('apps.notRunning', { name: tab.processName || tab.title }));
        return;
      }
      setTabs((list) => list.map((x) => (x.id === tab.id ? { ...x, hwnd: w.hwnd, title: w.title } : x)));
      markMissing(tab.id, false);
    },
    [setTabs, toast],
  );

  /** Onay bekleyen sekmenin penceresini panele yerleştirir. */
  const reattach = useCallback(
    async (tab: AppTab) => {
      const b = bounds();
      if (tab.hwnd === null || !b) return;
      const hwnd = tab.hwnd;
      setBusy(true);
      try {
        pending.current.add(hwnd);
        await embedService.attach(hwnd, b);
        setAttached((list) => (list.includes(hwnd) ? list : [...list, hwnd]));
        setIdle((list) => list.filter((x) => x !== tab.id));
      } catch (err) {
        toast.push('error', `${t('apps.embedFailed')}: ${describeError(err).description}`);
      } finally {
        pending.current.delete(hwnd);
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast],
  );

  return {
    tabs,
    active,
    setActiveId,
    missing,
    idle,
    reattach,
    attached,
    busy,
    add,
    pick,
    detach,
    focus,
    relocate,
  };
}
