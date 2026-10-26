import { Radio } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const radioModule: ModuleManifest = {
  id: 'radio',
  titleKey: 'modules.items.radio.title',
  descriptionKey: 'modules.items.radio.description',
  icon: Radio,
  category: 'media',
  defaultEnabled: true,
  panels: [{ id: 'radio', titleKey: 'panels.radio', icon: Radio, load: () => import('./RadioPanel').then((m) => ({ default: m.RadioPanel })) }],
  integrations: ['radiobrowser'],
};
