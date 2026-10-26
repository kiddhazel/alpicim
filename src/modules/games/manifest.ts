import { Gamepad2 } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const gamesModule: ModuleManifest = {
  id: 'games',
  titleKey: 'modules.items.games.title',
  descriptionKey: 'modules.items.games.description',
  icon: Gamepad2,
  category: 'fun',
  defaultEnabled: true,
  panels: [{ id: 'games', titleKey: 'panels.games', icon: Gamepad2, load: () => import('./GamesPanel').then((m) => ({ default: m.GamesPanel })) }],
};
