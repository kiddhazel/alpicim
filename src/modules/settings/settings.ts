import { useEffect } from 'react';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import type { Chattiness } from '../laila/brain';
import { isNewsCategory, type NewsCategory } from '../news/types';

export type ThemeMode = 'dark' | 'light' | 'system';
export type LayoutPreset = 'two' | 'three' | 'focus';
export type TickerSpeed = 'slow' | 'normal' | 'fast';

export interface Settings {
  theme: ThemeMode;
  /** Haberlerin otomatik yenilenme aralığı (dakika). */
  newsRefreshMinutes: number;
  /** Piyasa verilerinin otomatik yenilenme aralığı (saniye). */
  marketsRefreshSeconds: number;
  /** Ana pencere kapatılınca sistem tepsisine gizlensin mi? */
  closeToTray: boolean;
  /** Anahtar yoksa açıkça DEMO etiketli örnek piyasa verisi gösterilsin mi? */
  showDemoData: boolean;
  /** Açılışta ana pencere gösterilmeden tepside başlasın mı? */
  startHidden: boolean;
  /** Performans modu: daha seyrek yenileme, animasyon yok, saniyesiz saat. */
  performanceMode: boolean;
  /** Müzik paneli gizlenince/kapatılınca çalmaya devam etsin mi? (false → ses durur) */
  musicKeepPlaying: boolean;
  /** Açık Windows pencerelerini panellere alma özelliği (deneysel). */
  embedEnabled: boolean;
  /** Kısayol tıklanınca uygulama zaten açıksa yeni örnek yerine penceresine odaklan. */
  launcherFocusExisting: boolean;
  /** Alt çubukta haber/piyasa şeridi gösterilsin mi? */
  barTicker: boolean;
  /** Alt çubukta mini oynatıcı gösterilsin mi? */
  barPlayer: boolean;
  /** Kayan yazı hızı. */
  tickerSpeed: TickerSpeed;
  /** Şeritte gösterilecek haber kategorisi. */
  tickerCategory: NewsCategory | 'all';
  /** Şeritteki en fazla fiyat çipi sayısı. */
  tickerQuotes: number;
  /** Laila uygulamada gezsin mi? */
  lailaEnabled: boolean;
  /** Laila ara sıra masaüstüne çıkabilsin mi? */
  lailaDesktop: boolean;
  /** Laila ne kadar konuşkan. */
  lailaChat: Chattiness;
}

export const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  newsRefreshMinutes: 15,
  marketsRefreshSeconds: 300,
  closeToTray: true,
  showDemoData: false,
  startHidden: false,
  performanceMode: false,
  musicKeepPlaying: true,
  embedEnabled: true,
  launcherFocusExisting: true,
  barTicker: true,
  barPlayer: true,
  tickerSpeed: 'normal',
  tickerCategory: 'all',
  tickerQuotes: 4,
  lailaEnabled: true,
  lailaDesktop: true,
  lailaChat: 'normal',
};

export const LIMITS = {
  tickerQuotes: { min: 0, max: 8 },
  newsRefreshMinutes: { min: 5, max: 180 },
  marketsRefreshSeconds: { min: 60, max: 3600 },
} as const;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Depodan gelen veriyi doğrular; eksik/bozuk alanlar varsayılana döner. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const d = DEFAULT_SETTINGS;
  return {
    theme: oneOf(r.theme, ['dark', 'light', 'system'] as const, d.theme),
    newsRefreshMinutes: clamp(
      r.newsRefreshMinutes,
      LIMITS.newsRefreshMinutes.min,
      LIMITS.newsRefreshMinutes.max,
      d.newsRefreshMinutes,
    ),
    marketsRefreshSeconds: clamp(
      r.marketsRefreshSeconds,
      LIMITS.marketsRefreshSeconds.min,
      LIMITS.marketsRefreshSeconds.max,
      d.marketsRefreshSeconds,
    ),
    closeToTray: typeof r.closeToTray === 'boolean' ? r.closeToTray : d.closeToTray,
    showDemoData: typeof r.showDemoData === 'boolean' ? r.showDemoData : d.showDemoData,
    startHidden: typeof r.startHidden === 'boolean' ? r.startHidden : d.startHidden,
    lailaEnabled: typeof r.lailaEnabled === 'boolean' ? r.lailaEnabled : d.lailaEnabled,
    lailaDesktop: typeof r.lailaDesktop === 'boolean' ? r.lailaDesktop : d.lailaDesktop,
    lailaChat: r.lailaChat === 'quiet' || r.lailaChat === 'normal' || r.lailaChat === 'chatty' ? r.lailaChat : d.lailaChat,
    performanceMode: typeof r.performanceMode === 'boolean' ? r.performanceMode : d.performanceMode,
    musicKeepPlaying: typeof r.musicKeepPlaying === 'boolean' ? r.musicKeepPlaying : d.musicKeepPlaying,
    embedEnabled: typeof r.embedEnabled === 'boolean' ? r.embedEnabled : d.embedEnabled,
    launcherFocusExisting:
      typeof r.launcherFocusExisting === 'boolean' ? r.launcherFocusExisting : d.launcherFocusExisting,
    barTicker: typeof r.barTicker === 'boolean' ? r.barTicker : d.barTicker,
    barPlayer: typeof r.barPlayer === 'boolean' ? r.barPlayer : d.barPlayer,
    tickerSpeed: oneOf(r.tickerSpeed, ['slow', 'normal', 'fast'] as const, d.tickerSpeed),
    tickerCategory: r.tickerCategory === 'all' || isNewsCategory(r.tickerCategory) ? r.tickerCategory : d.tickerCategory,
    tickerQuotes: clamp(r.tickerQuotes, LIMITS.tickerQuotes.min, LIMITS.tickerQuotes.max, d.tickerQuotes),
  };
}

/** Performans modunu kök öğeye uygular (CSS geçişleri/animasyonlar kapanır). */
export function useApplyPerformanceMode(on: boolean) {
  useEffect(() => {
    document.documentElement.dataset.perf = on ? 'on' : 'off';
  }, [on]);
}

export function useSettings() {
  return usePersistentState<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS, sanitizeSettings);
}

/** Tema ayarını <html data-theme> özniteliğine uygular; "sistem" seçiliyse Windows temasını izler. */
export function useApplyTheme(mode: ThemeMode) {
  useEffect(() => {
    const root = document.documentElement;
    if (mode !== 'system') {
      root.dataset.theme = mode;
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      root.dataset.theme = mq.matches ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);
}
