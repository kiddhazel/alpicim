import { LailaDesktop } from './modules/laila/LailaDesktop';
import { SnipListener } from './modules/screenshot/SnipListener';
import { SnipOverlay } from './modules/screenshot/SnipOverlay';
import { useApplyFocus } from './modules/focus/useFocus';
import { QuickWindow } from './modules/quick/QuickWindow';
import { DetachedWindow } from './modules/window-manager/DetachedWindow';
import { panelFromLabel } from './modules/window-manager/panels';
import { Screensaver } from './modules/screensaver/Screensaver';
import { useGameModeSync } from './modules/library/gameMode';
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
  useGameModeSync(settings.gameModeAuto);
  useApplyFocus();

  const label = currentWindowLabel();
  if (label === 'laila') return <LailaDesktop />;
  if (label === 'snip') return <SnipOverlay />;
  if (label === 'quick') return <QuickWindow />;
  const panel = panelFromLabel(label);

  return (
    <ToastProvider>{panel ? <DetachedWindow panel={panel} /> : <><Shell /><Screensaver />{label === 'main' && <SnipListener />}</>}</ToastProvider>
  );
}
