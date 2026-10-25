import { DetachedWindow } from './modules/window-manager/DetachedWindow';
import { panelFromLabel } from './modules/window-manager/panels';
import { Shell } from './modules/window-manager/Shell';
import { useApplyPerformanceMode, useApplyTheme, useSettings } from './modules/settings/settings';
import { currentWindowLabel } from './shared/lib/tauri';
import { ToastProvider } from './shared/ui/Toast';

/**
 * Her pencere aynı index.html'i yükler; hangi içeriğin gösterileceği pencere etiketinden çıkarılır:
 * "main" → ana kabuk, "panel-<id>" → ayrılmış panel.
 */
export function App() {
  const [settings] = useSettings();
  useApplyTheme(settings.theme);
  useApplyPerformanceMode(settings.performanceMode);

  const panel = panelFromLabel(currentWindowLabel());

  return (
    <ToastProvider>{panel ? <DetachedWindow panel={panel} /> : <Shell />}</ToastProvider>
  );
}
