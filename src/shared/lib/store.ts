import { emit, listen } from '@tauri-apps/api/event';
import { load, type Store } from '@tauri-apps/plugin-store';
import { currentWindowLabel, isTauri } from './tauri';

/**
 * Kalıcı anahtar-değer deposu (tauri-plugin-store, `alpicim.json`).
 * Bir pencerede yapılan değişiklik olayla diğer pencerelere duyurulur.
 * Tauri dışında (Vite önizlemesi) localStorage'a düşer.
 */

const STORE_FILE = 'alpicim.json';
const CHANGE_EVENT = 'alpicim://data-changed';
const LOCAL_PREFIX = 'alpicim:';

interface ChangePayload {
  key: string;
  source: string;
}

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { defaults: {}, autoSave: 300 });
  return storePromise;
}

const localListeners = new Map<string, Set<() => void>>();

function notifyLocal(key: string) {
  localListeners.get(key)?.forEach((cb) => cb());
}

export async function readKey<T>(key: string, fallback: T): Promise<T> {
  if (!isTauri()) {
    try {
      const raw = localStorage.getItem(LOCAL_PREFIX + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }
  const store = await getStore();
  const value = await store.get<T>(key);
  return value === undefined || value === null ? fallback : value;
}

export async function writeKey<T>(key: string, value: T): Promise<void> {
  if (!isTauri()) {
    try {
      localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value));
    } catch {
      /* önizleme modunda depolama kullanılamıyorsa yok say */
    }
    notifyLocal(key);
    return;
  }
  const store = await getStore();
  await store.set(key, value);
  notifyLocal(key);
  const payload: ChangePayload = { key, source: currentWindowLabel() };
  await emit(CHANGE_EVENT, payload);
}

/** Bir anahtar başka bir pencerede (veya aynı pencerede başka bir bileşende) değişince çağrılır. */
export function onKeyChanged(key: string, callback: () => void): () => void {
  let set = localListeners.get(key);
  if (!set) {
    set = new Set();
    localListeners.set(key, set);
  }
  set.add(callback);

  let unlisten: (() => void) | null = null;
  let disposed = false;
  if (isTauri()) {
    const me = currentWindowLabel();
    void listen<ChangePayload>(CHANGE_EVENT, (event) => {
      if (event.payload.key === key && event.payload.source !== me) callback();
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
  }

  return () => {
    disposed = true;
    set.delete(callback);
    unlisten?.();
  };
}
