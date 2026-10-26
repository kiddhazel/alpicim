import { Cpu } from 'lucide-react';
import type { ModuleManifest } from '../../../core/modules/types';

/** Sistem izleme widget'ları: CPU/RAM/disk, GPU, ses karıştırıcı. */
export const systemModule: ModuleManifest = {
  id: 'system',
  titleKey: 'modules.items.system.title',
  descriptionKey: 'modules.items.system.description',
  icon: Cpu,
  category: 'system',
  defaultEnabled: true,
  widgets: ['system', 'gpu', 'mixer'],
};
