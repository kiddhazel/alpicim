import { Newspaper } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const newsModule: ModuleManifest = {
  id: 'news',
  titleKey: 'modules.items.news.title',
  descriptionKey: 'modules.items.news.description',
  icon: Newspaper,
  category: 'info',
  defaultEnabled: true,
  panels: [{ id: 'news', titleKey: 'panels.news', icon: Newspaper, load: () => import('./NewsPanel').then((m) => ({ default: m.NewsPanel })) }],
  widgets: ['news'],
  integrations: ['googlenews'],
};
