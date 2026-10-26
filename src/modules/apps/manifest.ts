import { PictureInPicture2 } from 'lucide-react';
import { createElement } from 'react';
import type { ModuleManifest } from '../../core/modules/types';

export const appsModule: ModuleManifest = {
  id: 'apps',
  titleKey: 'modules.items.apps.title',
  descriptionKey: 'modules.items.apps.description',
  icon: PictureInPicture2,
  category: 'system',
  defaultEnabled: true,
  panels: [
    {
      id: 'apps',
      titleKey: 'panels.apps',
      icon: PictureInPicture2,
      load: () => import('./AppsPanel').then((m) => ({ default: (p) => createElement(m.AppsPanel, { onOpenSettings: () => p.onOpenPanel('settings') }) })),
    },
  ],
  widgets: ['windows'],
};
