import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveView, useInterval, useOnline } from '../../shared/lib/hooks';
import { onKeyChanged } from '../../shared/lib/store';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { INTEGRATION_KEYS } from '../integrations/integrationsService';
import { useIntegrationStates, useKeyVersion } from '../integrations/useIntegrations';
import { EMPTY_CACHE, hasTwelveDataKey, loadMarketCache, MARKET_KEYS, refreshMarkets, sanitizeConfig, type MarketCache } from './marketService';
import { DEFAULT_MARKETS_CONFIG, type MarketsConfig } from './types';

/** Anahtar kaydedilince/silinince yayılan yerel olay (Ayarlar → Entegrasyonlar). */
export const KEY_STATUS_KEY = INTEGRATION_KEYS.keyVersion;

export function useMarkets(refreshSeconds: number) {
  const [config, setConfig, configLoaded] = usePersistentState<MarketsConfig>(
    MARKET_KEYS.config,
    DEFAULT_MARKETS_CONFIG,
    sanitizeConfig,
  );
  const keyVersion = useKeyVersion();
  const [integrations, , integrationsLoaded] = useIntegrationStates();
  const { tcmb, frankfurter, twelvedata } = integrations;
  const [cache, setCache] = useState<MarketCache>(EMPTY_CACHE);
  const [storedKey, setHasKey] = useState<boolean | null>(null);
  // Entegrasyon kapalıysa anahtar varmış gibi davranılmaz; durumlar yüklenene kadar ağa çıkılmaz.
  const hasKey = storedKey === null || !integrationsLoaded ? null : storedKey && twelvedata;
  const [refreshing, setRefreshing] = useState(false);
  const online = useOnline();
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    const pull = () => void loadMarketCache().then((c) => alive && setCache(c));
    pull();
    const off = onKeyChanged(MARKET_KEYS.cache, pull);
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void hasTwelveDataKey().then((v) => alive && setHasKey(v));
    return () => {
      alive = false;
    };
  }, [keyVersion]);

  const refresh = useCallback(
    async (force = false) => {
      if (busy.current || hasKey === null) return;
      busy.current = true;
      setRefreshing(true);
      try {
        setCache(
          await refreshMarkets({
            config,
            hasKey,
            liveMaxAgeMs: refreshSeconds * 1000,
            force,
            enabled: { tcmb, frankfurter, twelvedata },
          }),
        );
      } finally {
        busy.current = false;
        setRefreshing(false);
      }
    },
    [config, hasKey, refreshSeconds, tcmb, frankfurter, twelvedata],
  );

  useEffect(() => {
    if (configLoaded && hasKey !== null) void refresh(false);
  }, [configLoaded, hasKey, refresh]);

  // Periyodik yenileme yalnızca görünürken (pencere açık ve panel etkin sekme); görünür olunca bayatsa hemen yenilenir.
  const active = useActiveView();
  useEffect(() => {
    if (active && configLoaded && hasKey !== null) void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız görünürlük değişince
  }, [active]);
  useInterval(() => {
    if (online) void refresh(false);
  }, configLoaded && active ? refreshSeconds * 1000 : null);

  return {
    config,
    setConfig,
    cache,
    hasKey,
    /** Twelve Data Ayarlar → Entegrasyonlar'dan kapatıldı. */
    liveDisabled: integrationsLoaded && !twelvedata,
    refreshing,
    refresh,
    online,
    loaded: configLoaded,
  };
}
