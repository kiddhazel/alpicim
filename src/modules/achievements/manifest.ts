import { Trophy } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const achievementsModule: ModuleManifest = {
  id: 'achievements',
  titleKey: 'modules.items.achievements.title',
  descriptionKey: 'modules.items.achievements.description',
  icon: Trophy,
  category: 'fun',
  defaultEnabled: true,
  services: [{ id: 'achievement-tracker', host: 'shell-logic', load: () => import('./AchievementService') }],
};
