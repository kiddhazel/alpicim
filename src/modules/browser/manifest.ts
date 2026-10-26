import { Globe, ShieldCheck } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const browserModule: ModuleManifest = {
  id: 'browser',
  titleKey: 'modules.items.browser.title',
  descriptionKey: 'modules.items.browser.description',
  icon: Globe,
  category: 'work',
  defaultEnabled: true,
  panels: [{ id: 'browser', titleKey: 'panels.browser', icon: Globe, load: () => import('./BrowserPanel').then((m) => ({ default: m.BrowserPanel })) }],
  settings: [
    {
      id: 'adblock',
      titleKey: 'adblock.title',
      descriptionKey: 'redesign.sectionAdblock',
      icon: ShieldCheck,
      load: () => import('./AdblockSettings').then((m) => ({ default: m.AdblockSettings })),
    },
  ],
  integrations: ['adblock', 'favicons'],
};
