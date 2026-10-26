import { Target } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';
import { t } from '../../i18n';

export const focusModule: ModuleManifest = {
  id: 'focus',
  titleKey: 'modules.items.focus.title',
  descriptionKey: 'modules.items.focus.description',
  icon: Target,
  category: 'work',
  defaultEnabled: true,
  services: [{ id: 'focus-apply', host: 'app-all', load: () => import('./FocusService') }],
  settings: [
    {
      id: 'focus',
      titleKey: 'focus.title',
      icon: Target,
      load: () => import('./FocusSettings').then((m) => ({ default: m.FocusSettings })),
    },
  ],
  commands: (ctx) => [
    {
      id: 'act:focus',
      group: 'action',
      title: ctx.focus.on ? t('focus.paletteOff') : t('focus.paletteOn'),
      keywords: 'odak focus sessiz dikkat pomodoro',
      run: ctx.focus.toggle,
    },
  ],
};
