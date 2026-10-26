import { lazy, Suspense } from 'react';
import { t } from '../../i18n';
import { ErrorBoundary } from '../../shared/ui/ErrorBoundary';
import { StateView } from '../../shared/ui/StateView';
import type { PanelId } from './panels';

// Paneller ayrı parçalar (chunk) olarak yalnızca ilk gösterildiklerinde yüklenir.
const AppsPanel = lazy(() => import('../apps/AppsPanel').then((m) => ({ default: m.AppsPanel })));
const ClipboardPanel = lazy(() => import('../clipboard/ClipboardPanel').then((m) => ({ default: m.ClipboardPanel })));
const GamesPanel = lazy(() => import('../games/GamesPanel').then((m) => ({ default: m.GamesPanel })));
const LibraryPanel = lazy(() => import('../library/LibraryPanel').then((m) => ({ default: m.LibraryPanel })));
const RoomPanel = lazy(() => import('../room/RoomPanel').then((m) => ({ default: m.RoomPanel })));
const RadioPanel = lazy(() => import('../radio/RadioPanel').then((m) => ({ default: m.RadioPanel })));
const PodcastsPanel = lazy(() => import('../podcasts/PodcastsPanel').then((m) => ({ default: m.PodcastsPanel })));
const NotesPanel = lazy(() => import('../notebook/NotesPanel').then((m) => ({ default: m.NotesPanel })));
const BrowserPanel = lazy(() => import('../browser/BrowserPanel').then((m) => ({ default: m.BrowserPanel })));
const LauncherPanel = lazy(() => import('../launcher/LauncherPanel').then((m) => ({ default: m.LauncherPanel })));
const MarketsPanel = lazy(() => import('../markets/MarketsPanel').then((m) => ({ default: m.MarketsPanel })));
const MusicPanel = lazy(() => import('../music/MusicPanel').then((m) => ({ default: m.MusicPanel })));
const NewsPanel = lazy(() => import('../news/NewsPanel').then((m) => ({ default: m.NewsPanel })));
const SettingsPanel = lazy(() => import('../settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel })));
const WidgetBoard = lazy(() => import('../widgets/WidgetBoard').then((m) => ({ default: m.WidgetBoard })));

/** Panel kimliğini içerik bileşenine eşler. Yeni modüller buraya eklenir. Hata veren panel diğerlerini etkilemez. */
export function PanelHost({ panel, onOpenPanel }: { panel: PanelId; onOpenPanel: (p: PanelId) => void }) {
  return (
    <ErrorBoundary resetKey={panel}>
      <Suspense fallback={<StateView kind="loading" title={t('common.loading')} />}>
        <PanelContent panel={panel} onOpenPanel={onOpenPanel} />
      </Suspense>
    </ErrorBoundary>
  );
}

function PanelContent({ panel, onOpenPanel }: { panel: PanelId; onOpenPanel: (p: PanelId) => void }) {
  switch (panel) {
    case 'home':
      return <WidgetBoard onOpenPanel={onOpenPanel} />;
    case 'news':
      return <NewsPanel />;
    case 'markets':
      return <MarketsPanel onOpenSettings={() => onOpenPanel('settings')} />;
    case 'launcher':
      return <LauncherPanel />;
    case 'browser':
      return <BrowserPanel />;
    case 'music':
      return <MusicPanel />;
    case 'apps':
      return <AppsPanel onOpenSettings={() => onOpenPanel('settings')} />;
    case 'notes':
      return <NotesPanel onOpenPanel={onOpenPanel} />;
    case 'clipboard':
      return <ClipboardPanel onOpenPanel={onOpenPanel} />;
    case 'radio':
      return <RadioPanel />;
    case 'podcasts':
      return <PodcastsPanel />;
    case 'room':
      return <RoomPanel />;
    case 'games':
      return <GamesPanel />;
    case 'library':
      return <LibraryPanel />;
    case 'settings':
      return <SettingsPanel />;
  }
}
