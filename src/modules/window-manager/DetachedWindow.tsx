import { PanelLeftClose } from 'lucide-react';
import { useCallback } from 'react';
import { t } from '../../i18n';
import { IconButton } from '../../shared/ui/primitives';
import { TitleBar } from '../../shared/ui/TitleBar';
import { useToast } from '../../shared/ui/Toast';
import { describeError } from '../../shared/ui/StateView';
import { dockIntoActiveWorkspace } from '../workspaces/workspaces';
import { PanelHost } from './PanelHost';
import { panelMeta, type PanelId } from './panels';
import { useWindowChrome } from './useWindowChrome';
import { windowService } from './windowService';

/** Ana uygulamadan ayrılmış tek panel penceresi. */
export function DetachedWindow({ panel }: { panel: PanelId }) {
  const chrome = useWindowChrome();
  const toast = useToast();
  const meta = panelMeta(panel);

  const dock = useCallback(async () => {
    try {
      await dockIntoActiveWorkspace(panel);
      await windowService.closePanelWindow(panel);
    } catch (err) {
      toast.push('error', describeError(err).title);
    }
  }, [panel, toast]);

  const openPanel = useCallback(
    (target: PanelId) => {
      windowService.openPanelWindow(target).catch(() => {});
    },
    [],
  );

  return (
    <div className="flex h-full flex-col bg-bg">
      <TitleBar
        title={t(meta.titleKey)}
        icon={meta.icon}
        pinned={chrome.pinned}
        maximized={chrome.maximized}
        onTogglePin={chrome.togglePin}
        onMinimize={() => void windowService.minimize()}
        onToggleMaximize={() => void windowService.toggleMaximize()}
        onClose={() => void windowService.closePanelWindow(panel).catch(() => {})}
      >
        <IconButton size="sm" icon={PanelLeftClose} label={t('shell.dock')} onClick={() => void dock()} />
      </TitleBar>
      <div className="min-h-0 flex-1 px-4 pb-3">
        <div className="h-full overflow-hidden rounded-xl">
          <PanelHost panel={panel} onOpenPanel={openPanel} />
        </div>
      </div>
    </div>
  );
}

