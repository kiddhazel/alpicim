import { Camera } from 'lucide-react';
import type { ModuleManifest } from '../../core/modules/types';
import { t } from '../../i18n';
import { isTauri } from '../../shared/lib/tauri';
import { describeError } from '../../shared/ui/StateView';
import { screenshotService } from './screenshotService';

export const screenshotModule: ModuleManifest = {
  id: 'screenshot',
  titleKey: 'modules.items.screenshot.title',
  descriptionKey: 'modules.items.screenshot.description',
  icon: Camera,
  category: 'system',
  defaultEnabled: true,
  services: [{ id: 'snip-listener', host: 'app-main', load: () => import('./SnipListener').then((m) => ({ default: m.SnipListener })) }],
  commands: (ctx) =>
    isTauri()
      ? [
          {
            id: 'act:screenshot',
            group: 'action',
            title: t('palette.screenshot'),
            keywords: 'ekran görüntüsü ekran alıntısı screenshot snip kırp',
            run: () =>
              screenshotService.start().catch((err: unknown) => ctx.toast.push('error', `${t('screenshot.failed')}: ${describeError(err).description}`)),
          },
          {
            id: 'act:record',
            group: 'action',
            title: t('palette.recordScreen'),
            keywords: 'ekran kaydı video kayıt record',
            run: () => screenshotService.openRecorder().catch(() => ctx.toast.push('error', t('screenshot.recordFailed'))),
          },
        ]
      : [],
};
