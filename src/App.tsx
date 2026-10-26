import { ModuleServices } from './core/modules/ModuleServices';
import { LailaDesktop } from './modules/laila/LailaDesktop';
import { SnipOverlay } from './modules/screenshot/SnipOverlay';
import { QuickWindow } from './modules/quick/QuickWindow';
import { DetachedWindow } from './modules/window-manager/DetachedWindow';
import { panelFromLabel } from './modules/window-manager/panels';
import { Shell } from './modules/window-manager/Shell';
import { useApplyPerformanceMode, useApplyTheme, useSettings } from './modules/settings/settings';
import { currentWindowLabel } from './shared/lib/tauri';
import { ToastProvider } from './shared/ui/Toast';

/**
 * Her pencere aynı index.html'i yükler; hangi içeriğin gösterileceği pencere etiketinden çıkarılır:
 * "main" → ana kabuk, "panel-<id>" → ayrılmış panel. Arka plan servisleri etkin modüllerin bildiriminden bağlanır.
 */
export function App() {
  const [settings] = useSettings();
  useApplyTheme(settings.theme);
  useApplyPerformanceMode(settings.performanceMode);

  const label = currentWindowLabel();
  const everywhere = <ModuleServices host="app-all" />;
  if (label === 'laila') return <>{everywhere}<LailaDesktop /></>;
  if (label === 'snip') return <>{everywhere}<SnipOverlay /></>;
  if (label === 'quick') return <>{everywhere}<QuickWindow /></>;
  const panel = panelFromLabel(label);

  return (
    <>
      {everywhere}
      <ToastProvider>
        {panel ? (
          <DetachedWindow panel={panel} />
        ) : (
          <>
            <Shell />
            {label === 'main' ? <ModuleServices host="app-main" /> : null}
          </>
        )}
      </ToastProvider>
    </>
  );
}
