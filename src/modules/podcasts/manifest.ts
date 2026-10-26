import { Podcast } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const podcastsModule: ModuleManifest = {
  id: 'podcasts',
  titleKey: 'modules.items.podcasts.title',
  descriptionKey: 'modules.items.podcasts.description',
  icon: Podcast,
  category: 'media',
  defaultEnabled: true,
  panels: [{ id: 'podcasts', titleKey: 'panels.podcasts', icon: Podcast, load: () => import('./PodcastsPanel').then((m) => ({ default: m.PodcastsPanel })) }],
  integrations: ['podcasts'],
};
