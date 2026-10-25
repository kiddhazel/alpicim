import { useCallback, useEffect, useState } from 'react';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { hasIntegrationKey, INTEGRATION_KEYS } from './integrationsService';
import {
  defaultIntegrationStates,
  getIntegration,
  INTEGRATIONS,
  integrationStatus,
  isUsable,
  sanitizeIntegrationStates,
  type IntegrationId,
  type IntegrationStates,
  type IntegrationStatus,
} from './registry';

/** Yalnızca açık/kapalı durumları (anahtar sorgusu yapmaz). Pencereler arasında eşitlenir. */
export function useIntegrationStates() {
  return usePersistentState<IntegrationStates>(INTEGRATION_KEYS.states, defaultIntegrationStates(), sanitizeIntegrationStates);
}

/** Anahtar kaydedilince/silinince değişen sürüm (anahtar durumunu yeniden sormak için). */
export function useKeyVersion(): number {
  const [version] = usePersistentState<number>(INTEGRATION_KEYS.keyVersion, 0, (raw) => (typeof raw === 'number' ? raw : 0));
  return version;
}

type KeyMap = Partial<Record<IntegrationId, boolean>>;

/** Durumlar + anahtar kayıt bilgisi. `status(id)` yüklenme sürerken null döner. */
export function useIntegrations() {
  const [states, setStates, loaded] = useIntegrationStates();
  const keyVersion = useKeyVersion();
  const [keys, setKeys] = useState<KeyMap | null>(null);

  useEffect(() => {
    let alive = true;
    const keyed = INTEGRATIONS.filter((d) => d.key);
    void Promise.all(keyed.map(async (d) => [d.id, await hasIntegrationKey(d.id)] as const)).then((pairs) => {
      if (alive) setKeys(Object.fromEntries(pairs) as KeyMap);
    });
    return () => {
      alive = false;
    };
  }, [keyVersion]);

  const setEnabled = useCallback(
    (id: IntegrationId, enabled: boolean) => setStates((s) => ({ ...s, [id]: enabled })),
    [setStates],
  );

  const status = useCallback(
    (id: IntegrationId): IntegrationStatus | null => {
      if (!loaded) return null;
      return integrationStatus(getIntegration(id), states[id], keys ? (keys[id] ?? false) : null);
    },
    [loaded, states, keys],
  );

  return { states, setEnabled, keys, loaded, status };
}

/**
 * Tek bir anahtarsız entegrasyonun açık olup olmadığı (render sırasında senkron kullanım için).
 * Yüklenene kadar null döner; çağıran taraf bu sürede ağa çıkmamalı.
 */
export function useIntegrationEnabled(id: IntegrationId): boolean | null {
  const [states, , loaded] = useIntegrationStates();
  return loaded ? states[id] : null;
}

/** Anahtarlı/anahtarsız bir entegrasyonun kullanılabilirliği (durum + anahtar). */
export function useIntegrationStatus(id: IntegrationId): { status: IntegrationStatus | null; usable: boolean } {
  const { status } = useIntegrations();
  const s = status(id);
  return { status: s, usable: isUsable(s) };
}
