import { AppWindow } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';

export const launcherModule: ModuleManifest = {
  id: 'launcher',
  titleKey: 'modules.items.launcher.title',
  descriptionKey: 'modules.items.launcher.description',
  icon: AppWindow,
  category: 'work',
  defaultEnabled: true,
  panels: [{ id: 'launcher', titleKey: 'panels.launcher', icon: AppWindow, load: () => import('./LauncherPanel').then((m) => ({ default: m.LauncherPanel })) }],
};
