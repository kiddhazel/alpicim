import { ListChecks } from 'lucide-react';
import type { ModuleManifest } from '../../../core/modules/types';

/** Günlük araçlar: alışkanlıklar, geri sayım, döviz çevirici (yalnız widget). */
export const dailyModule: ModuleManifest = {
  id: 'daily',
  titleKey: 'modules.items.daily.title',
  descriptionKey: 'modules.items.daily.description',
  icon: ListChecks,
  category: 'work',
  defaultEnabled: true,
  widgets: ['habits', 'countdown', 'converter'],
  integrations: ['tcmb'],
};
