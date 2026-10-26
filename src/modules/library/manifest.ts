import { Library } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const libraryModule: ModuleManifest = {
  id: 'library',
  titleKey: 'modules.items.library.title',
  descriptionKey: 'modules.items.library.description',
  icon: Library,
  category: 'games',
  defaultEnabled: true,
  panels: [{ id: 'library', titleKey: 'panels.library', icon: Library, load: () => import('./LibraryPanel').then((m) => ({ default: m.LibraryPanel })) }],
  services: [{ id: 'game-mode', host: 'app-all', load: () => import('./GameModeService') }],
  integrations: ['steamcdn'],
};
