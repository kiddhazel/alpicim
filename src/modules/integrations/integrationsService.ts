import { readKey, writeKey } from '../../shared/lib/store';
import { AppError, call, isTauri } from '../../shared/lib/tauri';
import { getIntegration, sanitizeIntegrationStates, type IntegrationId, type IntegrationStates } from './registry';

export const INTEGRATION_KEYS = {
  /** Açık/kapalı durumları: { [id]: boolean } */
  states: 'integrations',
  /**
   * Anahtar kaydedilince/silinince güncellenen sürüm damgası; dinleyenler anahtar durumunu yeniden sorar.
   * (Eski sürümle uyum için adı değiştirilmedi.)
   */
  keyVersion: 'markets.keyStatusVersion',
} as const;

export async function loadIntegrationStates(): Promise<IntegrationStates> {
  return sanitizeIntegrationStates(await readKey<unknown>(INTEGRATION_KEYS.states, {}));
}

export async function isIntegrationEnabled(id: IntegrationId): Promise<boolean> {
  try {
    return (await loadIntegrationStates())[id];
  } catch {
    return getIntegration(id).defaultEnabled;
  }
}

/** Entegrasyon kapalıysa `DISABLED` hatası fırlatır (adaptörler ağa çıkmadan önce çağırır). */
export async function assertIntegrationEnabled(id: IntegrationId): Promise<void> {
  if (!(await isIntegrationEnabled(id))) throw new AppError('DISABLED', id);
}

export async function setIntegrationEnabled(id: IntegrationId, enabled: boolean): Promise<void> {
  const states = await loadIntegrationStates();
  await writeKey(INTEGRATION_KEYS.states, { ...states, [id]: enabled });
}

function providerOf(id: IntegrationId): string {
  const key = getIntegration(id).key;
  if (!key) throw new AppError('PROVIDER', `${id} anahtar kullanmaz`);
  return key.providerId;
}

/** Anahtar kayıtlı mı? (Anahtarın kendisi webview'e hiç gelmez.) */
export async function hasIntegrationKey(id: IntegrationId): Promise<boolean> {
  if (!isTauri() || !getIntegration(id).key) return false;
  try {
    return await call<boolean>('secret_status', { provider: providerOf(id) });
  } catch {
    return false;
  }
}

async function bumpKeyVersion() {
  await writeKey(INTEGRATION_KEYS.keyVersion, Date.now());
}

export async function saveIntegrationKey(id: IntegrationId, value: string): Promise<void> {
  await call('secret_set', { provider: providerOf(id), value: value.trim() });
  await bumpKeyVersion();
}

export async function clearIntegrationKey(id: IntegrationId): Promise<void> {
  await call('secret_clear', { provider: providerOf(id) });
  await bumpKeyVersion();
}
