import { useSyncExternalStore } from 'react';
import type { Daypart } from './ambient';
import type { HolidayId } from './holidays';

export type FxPreview = 'none' | HolidayId | Daypart;

/** Bellekte tutulur (kalıcı değil); aynı kökenli pencereler arasında BroadcastChannel ile paylaşılır. */
let value: FxPreview = 'none';
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('alpicim-fx-preview');
if (channel) {
  channel.onmessage = (e: MessageEvent<unknown>) => {
    if (typeof e.data === 'string') {
      value = e.data as FxPreview;
      listeners.forEach((l) => l());
    }
  };
}

export function setFxPreview(next: FxPreview): void {
  value = next;
  listeners.forEach((l) => l());
  channel?.postMessage(next);
}

export function useFxPreview(): FxPreview {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => value,
  );
}
