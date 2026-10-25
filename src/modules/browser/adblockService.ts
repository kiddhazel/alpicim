import { listen } from '@tauri-apps/api/event';
import { call, isTauri } from '../../shared/lib/tauri';

/** Rust `adblock.rs` ile sözleşme. Komut/olay adları değişirse iki taraf birlikte güncellenir. */
export interface AdblockList {
  id: string;
  title: string;
  url: string;
  /** Diskteki kopyanın son güncellenme zamanı (ms), hiç indirilmediyse null. */
  updatedAt: number | null;
  rules: number;
}

export interface AdblockStatus {
  enabled: boolean;
  /** Motor kurulup filtreler yüklendi mi? (ilk açılışta indirme sürerken false) */
  ready: boolean;
  rules: number;
  lists: AdblockList[];
  /** Bu oturumda engellenen toplam istek. */
  blockedTotal: number;
  /** Reklam engellemenin kapalı olduğu alan adları (www. olmadan). */
  allowlist: string[];
  error: string | null;
  /** Listeler indiriliyor / motor yeniden kuruluyor. */
  updating: boolean;
}

/** `alpicim://adblock` olayı: bir webview'de engellenen istek sayısı (sayfa yüklenince sıfırlanır). */
export interface AdblockBlockedEvent {
  /** Webview etiketi, ör. `main-browser-t3` ya da `main-music`. */
  label: string;
  /** Geçerli sayfada şimdiye kadar engellenen istek sayısı. */
  blocked: number;
}

export const ADBLOCK_EVENT = 'alpicim://adblock';

export const adblockService = {
  status: () => call<AdblockStatus>('adblock_status'),
  setEnabled: (enabled: boolean) => call<AdblockStatus>('adblock_set_enabled', { enabled }),
  /** Filtre listelerini yeniden indirir ve motoru yeniden kurar. */
  update: () => call<AdblockStatus>('adblock_update'),
  /** `allowed = true`: bu alan adında reklam engelleme kapalı. */
  setSiteAllowed: (host: string, allowed: boolean) => call<AdblockStatus>('adblock_site_allow', { host, allowed }),

  onBlocked(cb: (e: AdblockBlockedEvent) => void): () => void {
    if (!isTauri()) return () => {};
    let off: (() => void) | null = null;
    let disposed = false;
    void listen<AdblockBlockedEvent>(ADBLOCK_EVENT, (e) => cb(e.payload)).then((fn) => {
      if (disposed) fn();
      else off = fn;
    });
    return () => {
      disposed = true;
      off?.();
    };
  },
};
