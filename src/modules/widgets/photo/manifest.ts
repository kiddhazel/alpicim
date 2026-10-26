import { Image } from 'lucide-react';
import type { ModuleManifest } from '../../../core/modules/types';

export const photoModule: ModuleManifest = {
  id: 'photo',
  titleKey: 'modules.items.photo.title',
  descriptionKey: 'modules.items.photo.description',
  icon: Image,
  category: 'info',
  defaultEnabled: true,
  widgets: ['photo'],
  integrations: ['wikimedia'],
};
