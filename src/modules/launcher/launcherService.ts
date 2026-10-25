import { open } from '@tauri-apps/plugin-dialog';
import { call, isTauri } from '../../shared/lib/tauri';

export type ItemKind = 'app' | 'shortcut' | 'folder' | 'file';

/** Rust → LaunchItemView */
export interface LaunchItem {
  id: string;
  name: string;
  path: string;
  kind: ItemKind;
  icon: string;
  category: string;
  favorite: boolean;
  addedAt: number;
  /** Kısayolun çözülmüş hedefi (.exe yolu veya steam:// adresi) */
  target?: string | null;
  /** Hedef hâlâ diskte var mı? */
  exists: boolean;
}

/** Rust → ScannedApp: Başlat menüsü/masaüstünde bulunan kısayol. */
export interface ScannedApp {
  name: string;
  /** Eklenecek kısayol dosyası (.lnk/.url) */
  path: string;
  /** Çözülmüş hedef (.exe veya steam:// …) */
  target: string;
  folder: string;
  source: 'startMenu' | 'desktop';
}

export interface NewLaunchItem {
  path: string;
  name?: string;
  category?: string;
  target?: string;
  icon?: string;
}

export interface AddManyResult {
  items: LaunchItem[];
  added: number;
  skipped: number;
}

export interface LaunchItemPatch {
  id: string;
  name?: string;
  icon?: string;
  category?: string;
  favorite?: boolean;
}

/** Kısayol listesi değişince yazılan sürüm anahtarı (diğer pencereler/widget'lar dinler). */
export const LAUNCHER_CHANGED_KEY = 'launcher.version';

/**
 * Kısayollar Rust tarafında (`launcher.json`) saklanır ve yalnızca kimlikle başlatılır.
 * Webview keyfî bir yolu çalıştıramaz; Rust her açılışta hedefi yeniden doğrular.
 */
export const launcherService = {
  list: () => call<LaunchItem[]>('launcher_list'),
  add: (path: string, category?: string) => call<LaunchItem[]>('launcher_add', { path, name: null, category: category ?? null }),
  update: (patch: LaunchItemPatch) => call<LaunchItem[]>('launcher_update', { patch }),
  remove: (id: string) => call<LaunchItem[]>('launcher_remove', { id }),
  reorder: (ids: string[]) => call<LaunchItem[]>('launcher_reorder', { ids }),
  /** `focusExisting`: uygulama zaten açıksa yeni örnek yerine penceresini öne getirir ("focused" döner). */
  launch: (id: string, focusExisting = false) => call<'launched' | 'focused'>('launcher_launch', { id, focusExisting }),
  addMany: (items: NewLaunchItem[]) => call<AddManyResult>('launcher_add_many', { items }),
  /** Başlat menüsü ve masaüstündeki uygulama/oyun kısayollarını tarar. */
  scan: () => call<ScannedApp[]>('launcher_scan'),

  /** Yerel dosya seçicisi: uygulama, .lnk kısayolu veya herhangi bir dosya. */
  async pickFiles(): Promise<string[]> {
    if (!isTauri()) return [];
    const result = await open({
      multiple: true,
      directory: false,
      title: 'Uygulama, kısayol veya dosya seçin',
      filters: [
        { name: 'Uygulamalar ve kısayollar', extensions: ['exe', 'lnk', 'url', 'appref-ms'] },
        { name: 'Tüm dosyalar', extensions: ['*'] },
      ],
    });
    return normalizeSelection(result);
  },

  async pickFolders(): Promise<string[]> {
    if (!isTauri()) return [];
    const result = await open({ multiple: true, directory: true, title: 'Klasör seçin' });
    return normalizeSelection(result);
  },
};

function normalizeSelection(result: string | string[] | null): string[] {
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

/** Ad, kategori ve yol üzerinde aksan/büyük harf duyarsız arama. */
export function matchesSearch(item: Pick<LaunchItem, 'name' | 'category' | 'path'>, query: string): boolean {
  const norm = (s: string) =>
    s
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  const q = norm(query.trim());
  if (!q) return true;
  const hay = norm(`${item.name} ${item.category} ${item.path}`);
  return q.split(/\s+/).every((w) => hay.includes(w));
}

/** Diziyi `from` konumundaki öğeyi `to` konumuna taşıyarak yeniden sıralar. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

// ---------------------------------------------------------------------------
// Simgeler: Rust, Windows kabuk simgesini PNG data URL olarak döndürür (diskte önbellekli).
// Burada da bellekte önbellek tutulur; aynı anda en fazla 4 istek yapılır.
// ---------------------------------------------------------------------------

const iconCache = new Map<string, Promise<string | null>>();
let active = 0;
const queue: Array<() => void> = [];

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active++;
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          queue.shift()?.();
        });
    };
    if (active < 4) run();
    else queue.push(run);
  });
}

export function loadIcon(path: string): Promise<string | null> {
  if (!isTauri()) return Promise.resolve(null);
  const key = path.toLowerCase();
  let p = iconCache.get(key);
  if (!p) {
    p = schedule(() => call<string | null>('launcher_icon', { path })).catch(() => null);
    iconCache.set(key, p);
  }
  return p;
}
