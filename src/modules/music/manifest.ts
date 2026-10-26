import { Music2 } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const musicModule: ModuleManifest = {
  id: 'music',
  titleKey: 'modules.items.music.title',
  descriptionKey: 'modules.items.music.description',
  icon: Music2,
  category: 'media',
  defaultEnabled: true,
  panels: [{ id: 'music', titleKey: 'panels.music', icon: Music2, load: () => import('./MusicPanel').then((m) => ({ default: m.MusicPanel })) }],
  widgets: ['music'],
  integrations: ['youtubemusic'],
};
