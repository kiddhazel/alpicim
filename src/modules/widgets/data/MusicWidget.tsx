import { Music2 } from 'lucide-react';
import { t } from '../../../i18n';
import { Button } from '../../../shared/ui/primitives';
import { MediaControls } from '../../system/MediaControls';
import { useWidgetHost } from '../WidgetHost';
import type { WidgetProps } from '../types';

export type MusicWidgetConfig = Record<string, never>;

/** Küçük medya denetimi: YouTube Music oturumu (varsa) ya da Windows'un geçerli medya oturumu. */
export function MusicWidget(_props: WidgetProps<MusicWidgetConfig>) {
  const host = useWidgetHost();
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-3">
      <MediaControls />
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-faint">{t('media.source')}</p>
        <Button variant="ghost" icon={Music2} onClick={() => host.openPanel('music')} className="h-8 px-2 text-xs">
          {t('panels.music')}
        </Button>
      </div>
    </div>
  );
}
