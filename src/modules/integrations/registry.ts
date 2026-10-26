import type { MessageKey } from '../../i18n';

/**
 * Alpicim'in konuştuğu tüm dış hizmetlerin tek listesi.
 *
 * - Anahtar gerektirenlerde `key.providerId`, Rust `providers.rs::PROVIDERS` tablosundaki kimliktir.
 *   Anahtarın hangi sunucuya ve nasıl (başlık / sorgu parametresi) gönderileceği yalnızca Rust'ta tanımlıdır;
 *   buradaki bilgi yalnızca görüntüleme içindir.
 * - `control`:
 *   - "toggle": kullanıcı Ayarlar → Entegrasyonlar'dan açıp kapatabilir; kapalıyken bağlı özellik ağa çıkmaz.
 *   - "settings": kendi ayar bölümü var (ör. reklam engelleyici); burada yalnızca bağlantı gösterilir.
 *   - "info": yalnızca kullanıcı ilgili paneli açtığında yüklenir; bilgi amaçlı listelenir.
 */

export type IntegrationCategory = 'markets' | 'weather' | 'news' | 'browser' | 'media' | 'calendar';

export const INTEGRATION_CATEGORIES: readonly IntegrationCategory[] = ['markets', 'weather', 'news', 'browser', 'media', 'calendar'];

export type IntegrationId =
  | 'tcmb'
  | 'frankfurter'
  | 'twelvedata'
  | 'openmeteo'
  | 'openweathermap'
  | 'googlenews'
  | 'favicons'
  | 'adblock'
  | 'youtubemusic'
  | 'wikimedia'
  | 'steamcdn'
  | 'radiobrowser'
  | 'podcasts'
  | 'ics';

export interface IntegrationKey {
  /** Rust `providers.rs` kimliği; `net_get` ve `secret_*` komutlarına bu gönderilir. */
  providerId: string;
  /** Kullanıcının anahtar alacağı sayfa. */
  signupUrl: string;
}

export interface IntegrationDef {
  id: IntegrationId;
  category: IntegrationCategory;
  name: MessageKey;
  description: MessageKey;
  /** Hangi özellikleri besliyor (kullanıcıya gösterilir). */
  powers: MessageKey;
  homepage: string;
  /** null → anahtarsız. */
  key: IntegrationKey | null;
  control: 'toggle' | 'settings' | 'info';
  /** `control: "settings"` için Ayarlar paneli bölüm kimliği. */
  settingsSection?: string;
  /** İlk kurulumdaki durum (anahtarlılarda anahtar girilene kadar zaten etkisizdir). */
  defaultEnabled: boolean;
}

export const INTEGRATIONS: readonly IntegrationDef[] = [
  {
    id: 'tcmb',
    category: 'markets',
    name: 'integrations.items.tcmb.name',
    description: 'integrations.items.tcmb.desc',
    powers: 'integrations.items.tcmb.powers',
    homepage: 'https://www.tcmb.gov.tr/kurlar/kurlar_tr.html',
    key: null,
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'frankfurter',
    category: 'markets',
    name: 'integrations.items.frankfurter.name',
    description: 'integrations.items.frankfurter.desc',
    powers: 'integrations.items.frankfurter.powers',
    homepage: 'https://frankfurter.dev',
    key: null,
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'twelvedata',
    category: 'markets',
    name: 'integrations.items.twelvedata.name',
    description: 'integrations.items.twelvedata.desc',
    powers: 'integrations.items.twelvedata.powers',
    homepage: 'https://twelvedata.com',
    key: { providerId: 'twelvedata', signupUrl: 'https://twelvedata.com/pricing' },
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'openmeteo',
    category: 'weather',
    name: 'integrations.items.openmeteo.name',
    description: 'integrations.items.openmeteo.desc',
    powers: 'integrations.items.openmeteo.powers',
    homepage: 'https://open-meteo.com',
    key: null,
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'openweathermap',
    category: 'weather',
    name: 'integrations.items.openweathermap.name',
    description: 'integrations.items.openweathermap.desc',
    powers: 'integrations.items.openweathermap.powers',
    homepage: 'https://openweathermap.org/api',
    key: { providerId: 'openweathermap', signupUrl: 'https://home.openweathermap.org/users/sign_up' },
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'googlenews',
    category: 'news',
    name: 'integrations.items.googlenews.name',
    description: 'integrations.items.googlenews.desc',
    powers: 'integrations.items.googlenews.powers',
    homepage: 'https://news.google.com',
    key: null,
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'favicons',
    category: 'browser',
    name: 'integrations.items.favicons.name',
    description: 'integrations.items.favicons.desc',
    powers: 'integrations.items.favicons.powers',
    homepage: 'https://www.google.com',
    key: null,
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'adblock',
    category: 'browser',
    name: 'integrations.items.adblock.name',
    description: 'integrations.items.adblock.desc',
    powers: 'integrations.items.adblock.powers',
    homepage: 'https://easylist.to',
    key: null,
    control: 'settings',
    settingsSection: 'adblock',
    defaultEnabled: true,
  },
  {
    id: 'youtubemusic',
    category: 'media',
    name: 'integrations.items.youtubemusic.name',
    description: 'integrations.items.youtubemusic.desc',
    powers: 'integrations.items.youtubemusic.powers',
    homepage: 'https://music.youtube.com',
    key: null,
    control: 'info',
    defaultEnabled: true,
  },
  {
    id: 'wikimedia',
    category: 'media',
    name: 'integrations.items.wikimedia.name',
    description: 'integrations.items.wikimedia.desc',
    powers: 'integrations.items.wikimedia.powers',
    homepage: 'https://commons.wikimedia.org',
    key: null,
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'steamcdn',
    category: 'media',
    name: 'integrations.items.steamcdn.name',
    description: 'integrations.items.steamcdn.desc',
    powers: 'integrations.items.steamcdn.powers',
    homepage: 'https://store.steampowered.com',
    key: null,
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'radiobrowser',
    category: 'media',
    name: 'integrations.items.radiobrowser.name',
    description: 'integrations.items.radiobrowser.desc',
    powers: 'integrations.items.radiobrowser.powers',
    homepage: 'https://www.radio-browser.info',
    key: null,
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'podcasts',
    category: 'media',
    name: 'integrations.items.podcasts.name',
    description: 'integrations.items.podcasts.desc',
    powers: 'integrations.items.podcasts.powers',
    homepage: 'https://podcasts.apple.com',
    key: null,
    control: 'toggle',
    defaultEnabled: true,
  },
  {
    id: 'ics',
    category: 'calendar',
    name: 'integrations.items.ics.name',
    description: 'integrations.items.ics.desc',
    powers: 'integrations.items.ics.powers',
    // Kullanıcının kendi adresi; genel bir ana sayfa yoktur (iCalendar belirtimi).
    homepage: 'https://www.rfc-editor.org/rfc/rfc5545',
    key: null,
    control: 'toggle',
    defaultEnabled: true,
  },
];

export function getIntegration(id: IntegrationId): IntegrationDef {
  const def = INTEGRATIONS.find((d) => d.id === id);
  if (!def) throw new Error(`Bilinmeyen entegrasyon: ${id}`);
  return def;
}

export function isIntegrationId(value: unknown): value is IntegrationId {
  return typeof value === 'string' && INTEGRATIONS.some((d) => d.id === value);
}

/** Kullanıcının açıp kapatabildiği entegrasyonların durumu. */
export type IntegrationStates = Record<IntegrationId, boolean>;

export function defaultIntegrationStates(): IntegrationStates {
  return Object.fromEntries(INTEGRATIONS.map((d) => [d.id, d.defaultEnabled])) as IntegrationStates;
}

/** Depodan gelen durumu doğrular: bilinmeyen alanlar atılır, eksik/bozuk olanlar varsayılana döner. */
export function sanitizeIntegrationStates(raw: unknown): IntegrationStates {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = defaultIntegrationStates();
  for (const def of INTEGRATIONS) {
    const v = r[def.id];
    // Yalnızca "toggle" türü kapatılabilir; diğerleri her zaman varsayılan.
    if (def.control === 'toggle' && typeof v === 'boolean') out[def.id] = v;
  }
  return out;
}

export type IntegrationStatus = 'keyless' | 'keyStored' | 'keyRequired' | 'off';

/**
 * Görüntülenecek durum. Anahtarlı bir entegrasyonun anahtar durumu henüz bilinmiyorsa (`hasKey === null`) null.
 */
export function integrationStatus(def: IntegrationDef, enabled: boolean, hasKey: boolean | null): IntegrationStatus | null {
  if (!enabled) return 'off';
  if (!def.key) return 'keyless';
  if (hasKey === null) return null;
  return hasKey ? 'keyStored' : 'keyRequired';
}

/** Bağlı özellik ağa çıkabilir mi? */
export function isUsable(status: IntegrationStatus | null): boolean {
  return status === 'keyless' || status === 'keyStored';
}

export function groupByCategory(defs: readonly IntegrationDef[] = INTEGRATIONS): Array<[IntegrationCategory, IntegrationDef[]]> {
  return INTEGRATION_CATEGORIES.map((c) => [c, defs.filter((d) => d.category === c)] as [IntegrationCategory, IntegrationDef[]]).filter(
    ([, list]) => list.length > 0,
  );
}
