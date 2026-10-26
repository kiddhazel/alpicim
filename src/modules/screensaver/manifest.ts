import { MonitorPlay } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const screensaverModule: ModuleManifest = {
  id: 'screensaver',
  titleKey: 'modules.items.screensaver.title',
  descriptionKey: 'modules.items.screensaver.description',
  icon: MonitorPlay,
  category: 'system',
  defaultEnabled: true,
  services: [{ id: 'screensaver', host: 'app-main', load: () => import('./Screensaver').then((m) => ({ default: m.Screensaver })) }],
};
