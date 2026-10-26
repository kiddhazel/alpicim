import { CloudRain } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

/** Ortam: hava ve özel gün efektleri, konfeti. Kapalıyken hiçbir efekt katmanı bağlanmaz. */
export const ambientModule: ModuleManifest = {
  id: 'ambient',
  titleKey: 'modules.items.ambient.title',
  descriptionKey: 'modules.items.ambient.description',
  icon: CloudRain,
  category: 'fun',
  defaultEnabled: true,
  services: [{ id: 'weather-fx', host: 'shell-background', load: () => import('./WeatherFx').then((m) => ({ default: m.WeatherFx })) }],
  settings: [
    {
      id: 'ambient',
      titleKey: 'fx.title',
      icon: CloudRain,
      load: () => import('./FxSettings'),
    },
  ],
};
