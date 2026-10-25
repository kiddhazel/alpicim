import { netGetOk } from '../../shared/lib/net';
import { AppError } from '../../shared/lib/tauri';
import { frankfurterProvider } from '../markets/adapters/frankfurter';
import { tcmbProvider } from '../markets/adapters/tcmb';
import { twelveDataProvider } from '../markets/adapters/twelvedata';
import { DEFAULT_FEEDS } from '../news/defaultFeeds';
import { searchCities } from '../widgets/weather/weatherService';
import { assertIntegrationEnabled } from './integrationsService';
import type { IntegrationId } from './registry';

/**
 * "Test et" düğmesi: sağlayıcıya tek, ucuz bir istek gönderir (normal adaptör yolu üzerinden, yani
 * anahtar yine yalnızca Rust tarafında eklenir). Başarısızsa AppError fırlatır.
 * Not: Twelve Data testi 1 API kredisi harcar.
 */
const TESTS: Partial<Record<IntegrationId, () => Promise<unknown>>> = {
  tcmb: () => tcmbProvider.getBulletin(),
  frankfurter: () => frankfurterProvider.getDailySeries('EUR', 'USD', 5),
  twelvedata: () => twelveDataProvider.getQuote({ symbol: 'EUR/USD', providerId: 'twelvedata' }),
  openmeteo: () => searchCities('Ankara', 'openmeteo'),
  openweathermap: () => searchCities('Ankara', 'openweathermap'),
  googlenews: async () => {
    await assertIntegrationEnabled('googlenews');
    const feed = DEFAULT_FEEDS[0];
    if (!feed) throw new AppError('PROVIDER');
    return netGetOk({ url: feed.url });
  },
};

export function canTestIntegration(id: IntegrationId): boolean {
  return id in TESTS;
}

export async function testIntegration(id: IntegrationId): Promise<void> {
  const run = TESTS[id];
  if (!run) throw new AppError('PROVIDER', id);
  await run();
}
