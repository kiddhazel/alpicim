import { Settings as SettingsIcon } from 'lucide-react';
import { createElement } from 'react';
import type { ModuleManifest } from '../../core/modules/types';

/** Ayarlar — zorunlu (modülleri buradan açıp kapatırsınız). Çekirdek bölümler SettingsPanel içindedir. */
export const settingsModule: ModuleManifest = {
  id: 'settings',
  titleKey: 'modules.items.settings.title',
  descriptionKey: 'modules.items.settings.description',
  icon: SettingsIcon,
  category: 'core',
  defaultEnabled: true,
  required: true,
  panels: [
    {
      id: 'settings',
      titleKey: 'panels.settings',
      icon: SettingsIcon,
      load: () => import('./SettingsPanel').then((m) => ({ default: () => createElement(m.SettingsPanel) })),
    },
  ],
};
