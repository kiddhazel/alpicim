import { useEffect, useRef } from 'react';
import { onKeyChanged, readKey } from '../../shared/lib/store';
import { call, isTauri } from '../../shared/lib/tauri';
import { requestNotebook } from '../notebook/notebookService';
import { isPanelId, type PanelId } from '../window-manager/panels';

export const QUICK_EVENT = 'alpicim://quick';
export const QUICK_REQUEST_KEY = 'quick.request';

export type QuickMode = 'search' | 'clipboard';

export interface QuickRequest {
  kind: 'panel' | 'note';
  id: string;
  at: number;
}

export function parseMode(raw: unknown): QuickMode {
  return raw === 'clipboard' ? 'clipboard' : 'search';
}

export function sanitizeQuickRequest(raw: unknown): QuickRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if ((r.kind !== 'panel' && r.kind !== 'note') || typeof r.id !== 'string' || typeof r.at !== 'number') return null;
  return { kind: r.kind, id: r.id, at: r.at };
}

/** Rust → quick.rs komutları. */
export const quickService = {
  mode: async () => parseMode(await call<unknown>('quick_mode')),
  hide: () => call<void>('quick_hide'),
  openMain: () => call<void>('quick_open_main'),
  isDesktop: isTauri,
};

/** Ana pencerede: hızlı pencereden gelen "panel aç / not aç" isteklerini işler. */
export function useQuickRequests(openPanel: (p: PanelId) => void) {
  const openRef = useRef(openPanel);
  openRef.current = openPanel;
  useEffect(() => {
    let last = Date.now();
    return onKeyChanged(QUICK_REQUEST_KEY, () => {
      void readKey<unknown>(QUICK_REQUEST_KEY, null).then((raw) => {
        const req = sanitizeQuickRequest(raw);
        if (!req || req.at <= last || Date.now() - req.at > 10_000) return;
        last = req.at;
        if (req.kind === 'panel' && isPanelId(req.id)) openRef.current(req.id);
        if (req.kind === 'note') {
          void requestNotebook({ action: 'open', id: req.id });
          openRef.current('notes');
        }
      });
    });
  }, []);
}
