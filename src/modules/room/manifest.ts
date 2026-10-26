import { Sofa } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const roomModule: ModuleManifest = {
  id: 'room',
  titleKey: 'modules.items.room.title',
  descriptionKey: 'modules.items.room.description',
  icon: Sofa,
  category: 'fun',
  defaultEnabled: true,
  panels: [{ id: 'room', titleKey: 'panels.room', icon: Sofa, load: () => import('./RoomPanel').then((m) => ({ default: m.RoomPanel })) }],
};
