import { ScrollText } from 'lucide-react';
import type { ModuleManifest } from '../../../core/modules/types';

export const proverbModule: ModuleManifest = {
  id: 'proverb',
  titleKey: 'modules.items.proverb.title',
  descriptionKey: 'modules.items.proverb.description',
  icon: ScrollText,
  category: 'fun',
  defaultEnabled: true,
  widgets: ['proverb'],
};
