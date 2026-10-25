import { useCallback, useEffect, useState } from 'react';
import { call, isTauri } from '../../shared/lib/tauri';
import { subscribe } from '../display/displayService';
import { EMPTY_SNAPSHOT, sanitizeSnapshot, type ClipSnapshot } from './clipboard';

const CLIPBOARD_EVENT = 'alpicim://clipboard';

/** Rust → clipboard.rs komutları. */
export const clipboardService = {
  list: async () => sanitizeSnapshot(await call<unknown>('clipboard_list')),
  copy: (id: string) => call<void>('clipboard_copy', { id }),
  remove: async (id: string) => sanitizeSnapshot(await call<unknown>('clipboard_delete', { id })),
  clear: async () => sanitizeSnapshot(await call<unknown>('clipboard_clear')),
  setPaused: async (paused: boolean) => sanitizeSnapshot(await call<unknown>('clipboard_set_paused', { paused })),
  pin: async (id: string, pinned: boolean) => sanitizeSnapshot(await call<unknown>('clipboard_pin', { id, pinned })),
};

/** Pano geçmişi durumu: ilk yükleme + Rust olaylarıyla canlı güncelleme. */
export function useClipboardHistory() {
  const desktop = isTauri();
  const [snapshot, setSnapshot] = useState<ClipSnapshot>(EMPTY_SNAPSHOT);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!desktop) return;
    let alive = true;
    clipboardService
      .list()
      .then((s) => alive && setSnapshot(s))
      .catch((err: unknown) => alive && setError(err))
      .finally(() => alive && setLoaded(true));
    const off = subscribe<unknown>(CLIPBOARD_EVENT, (raw) => setSnapshot(sanitizeSnapshot(raw)));
    return () => {
      alive = false;
      off();
    };
  }, [desktop]);

  /** Snapshot döndüren bir komutu çalıştırır ve sonucu uygular. */
  const run = useCallback(async (f: () => Promise<ClipSnapshot>) => {
    setSnapshot(await f());
  }, []);

  return { desktop, snapshot, loaded, error, run };
}
