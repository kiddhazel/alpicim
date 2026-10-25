import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** Uygulama Tauri webview'inde mi çalışıyor (yoksa yalnız Vite önizlemesi mi)? */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Uygulama genelinde kullanılan, anlamlı kodlu hata. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly detail?: string;

  constructor(code: AppErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }
}

export type AppErrorCode =
  | 'NOT_DESKTOP'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'HTTP'
  | 'API_KEY_MISSING'
  | 'RATE_LIMIT'
  | 'PARSE'
  | 'PROVIDER'
  /** Kullanıcı ilgili entegrasyonu Ayarlar → Entegrasyonlar'dan kapattı (detail: entegrasyon kimliği). */
  | 'DISABLED'
  | 'UNKNOWN';

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const text = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
  if (text.startsWith('API_KEY_MISSING')) return new AppError('API_KEY_MISSING');
  if (text.startsWith('NETWORK_OFFLINE')) return new AppError('OFFLINE');
  if (text.startsWith('NETWORK_TIMEOUT')) return new AppError('TIMEOUT');
  if (text.startsWith('NETWORK_ERROR')) return new AppError('OFFLINE', text);
  return new AppError('UNKNOWN', text);
}

/** Rust komutu çağırır; masaüstü dışında anlaşılır bir hata üretir. */
export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new AppError('NOT_DESKTOP');
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    throw toAppError(err);
  }
}

/** Geçerli pencerenin etiketi ("main" veya "panel-<id>"). */
export function currentWindowLabel(): string {
  if (!isTauri()) {
    const panel = new URLSearchParams(window.location.search).get('panel');
    return panel ? `panel-${panel}` : 'main';
  }
  return getCurrentWindow().label;
}
