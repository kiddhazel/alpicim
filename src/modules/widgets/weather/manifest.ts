import { CloudSun } from 'lucide-react';
import type { ModuleManifest } from '../../../core/modules/types';

export const weatherModule: ModuleManifest = {
  id: 'weather',
  titleKey: 'modules.items.weather.title',
  descriptionKey: 'modules.items.weather.description',
  icon: CloudSun,
  category: 'info',
  defaultEnabled: true,
  widgets: ['weather'],
  integrations: ['openmeteo', 'openweathermap'],
};
