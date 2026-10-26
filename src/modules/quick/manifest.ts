import { Zap } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

/** Hızlı pencere (genel kısayol) ve ondan gelen panel/not açma istekleri. */
export const quickModule: ModuleManifest = {
  id: 'quick',
  titleKey: 'modules.items.quick.title',
  descriptionKey: 'modules.items.quick.description',
  icon: Zap,
  category: 'system',
  defaultEnabled: true,
  services: [{ id: 'quick-requests', host: 'shell-logic', load: () => import('./QuickHost') }],
};
