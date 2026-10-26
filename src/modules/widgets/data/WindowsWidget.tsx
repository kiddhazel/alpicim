import { AppWindow, Focus, Plus } from 'lucide-react';
import { t } from '../../../i18n';
import { Button, IconButton } from '../../../shared/ui/primitives';
import { StateView } from '../../../shared/ui/StateView';
import { useToast } from '../../../shared/ui/Toast';
import { describeError } from '../../../shared/ui/StateView';
import { appName, embedService, useAppTabs } from '../../apps/embedService';
import { useWidgetHost } from '../WidgetHost';
import type { WidgetProps } from '../types';

export type WindowsWidgetConfig = Record<string, never>;

/** Pencereler paneline eklenmiş (sabitlenmiş) uygulamalar; tek tıkla öne getirme. */
export function WindowsWidget(_props: WidgetProps<WindowsWidgetConfig>) {
  const host = useWidgetHost();
  const toast = useToast();
  const [tabs] = useAppTabs();

  if (tabs.length === 0) {
    return (
      <StateView
        compact
        kind="empty"
        title={t('widgets.windows.empty')}
        action={
          <Button icon={Plus} onClick={() => host.openPanel('apps')}>
            {t('apps.add')}
          </Button>
        }
      />
    );
  }
  return (
    <ul className="h-full divide-y divide-line overflow-y-auto">
      {tabs.map((tab) => (
        <li key={tab.id} className="flex items-center gap-3 px-4 py-2.5">
          <AppWindow size={16} className="text-accent" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{appName(tab)}</p>
            <p className="truncate text-xs text-fg-3">{tab.title}</p>
          </div>
          <IconButton
            size="sm"
            icon={Focus}
            label={t('apps.bringToFront')}
            disabled={tab.hwnd === null}
            onClick={() => {
              if (tab.mode === 'embedded') host.openPanel('apps');
              else if (tab.hwnd !== null) embedService.activate(tab.hwnd).catch((err: unknown) => toast.push('error', describeError(err).description));
            }}
          />
        </li>
      ))}
    </ul>
  );
}
