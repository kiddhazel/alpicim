import { TrendingUp } from 'lucide-react';
import { createElement } from 'react';
import type { ModuleManifest } from '../../core/modules/types';

export const marketsModule: ModuleManifest = {
  id: 'markets',
  titleKey: 'modules.items.markets.title',
  descriptionKey: 'modules.items.markets.description',
  icon: TrendingUp,
  category: 'info',
  defaultEnabled: true,
  panels: [
    {
      id: 'markets',
      titleKey: 'panels.markets',
      icon: TrendingUp,
      load: () => import('./MarketsPanel').then((m) => ({ default: (p) => createElement(m.MarketsPanel, { onOpenSettings: () => p.onOpenPanel('settings') }) })),
    },
  ],
  widgets: ['markets'],
  integrations: ['tcmb', 'frankfurter', 'twelvedata'],
};
