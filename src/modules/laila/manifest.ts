import { Cat } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';
import { t } from '../../i18n';
import { isTauri } from '../../shared/lib/tauri';
import { LAILA_CHAT_EVENT, LAILA_LEAVE_EVENT } from './lailaEvents';

export const lailaModule: ModuleManifest = {
  id: 'laila',
  titleKey: 'modules.items.laila.title',
  descriptionKey: 'modules.items.laila.description',
  icon: Cat,
  category: 'fun',
  defaultEnabled: true,
  services: [{ id: 'laila', host: 'shell-overlay', load: () => import('./LailaHost') }],
  settings: [
    {
      id: 'laila',
      titleKey: 'laila.settingsTitle',
      icon: Cat,
      load: () => import('./LailaSettings'),
    },
  ],
  commands: ({ settings }) =>
    settings.lailaEnabled
      ? [
          { id: 'act:laila-chat', group: 'action', title: t('laila.paletteChat'), keywords: 'laila sohbet konuş', run: () => void window.dispatchEvent(new Event(LAILA_CHAT_EVENT)) },
          ...(settings.lailaDesktop && isTauri()
            ? [
                {
                  id: 'act:laila-leave',
                  group: 'action' as const,
                  title: t('laila.paletteLeave'),
                  keywords: 'laila dışarı masaüstü gez',
                  run: () => void window.dispatchEvent(new Event(LAILA_LEAVE_EVENT)),
                },
              ]
            : []),
        ]
      : [],
};
