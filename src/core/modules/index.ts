import type { ModuleManifest } from './types';
import { achievementsModule } from '../../modules/achievements/manifest';
import { appsModule } from '../../modules/apps/manifest';
import { browserModule } from '../../modules/browser/manifest';
import { clipboardModule } from '../../modules/clipboard/manifest';
import { focusModule } from '../../modules/focus/manifest';
import { ambientModule } from '../../modules/fx/manifest';
import { gamesModule } from '../../modules/games/manifest';
import { lailaModule } from '../../modules/laila/manifest';
import { launcherModule } from '../../modules/launcher/manifest';
import { libraryModule } from '../../modules/library/manifest';
import { marketsModule } from '../../modules/markets/manifest';
import { musicModule } from '../../modules/music/manifest';
import { newsModule } from '../../modules/news/manifest';
import { notesModule } from '../../modules/notebook/manifest';
import { podcastsModule } from '../../modules/podcasts/manifest';
import { quickModule } from '../../modules/quick/manifest';
import { radioModule } from '../../modules/radio/manifest';
import { roomModule } from '../../modules/room/manifest';
import { screenshotModule } from '../../modules/screenshot/manifest';
import { screensaverModule } from '../../modules/screensaver/manifest';
import { settingsModule } from '../../modules/settings/manifest';
import { homeModule } from '../../modules/window-manager/manifest';
import { dailyModule } from '../../modules/widgets/daily/manifest';
import { systemModule } from '../../modules/widgets/data/manifest';
import { fortuneModule, moodModule, watchlistModule } from '../../modules/widgets/fun/manifest';
import { photoModule } from '../../modules/widgets/photo/manifest';
import { proverbModule } from '../../modules/widgets/proverbs/manifest';
import { weatherModule } from '../../modules/widgets/weather/manifest';

/**
 * Tek modül kayıt listesi. Panel, widget, ayar bölümü, palet komutu ve arka plan servisleri buradan türetilir
 * (bkz. registry.ts / useModules.ts). Panel sırası = kenar çubuğu sırası; yeni modül buraya eklenir.
 */
export const MODULES: readonly ModuleManifest[] = [
  homeModule,
  newsModule,
  marketsModule,
  launcherModule,
  browserModule,
  musicModule,
  appsModule,
  notesModule,
  clipboardModule,
  gamesModule,
  libraryModule,
  roomModule,
  radioModule,
  podcastsModule,
  settingsModule,
  // Panelsiz modüller (widget / servis / komut)
  dailyModule,
  weatherModule,
  photoModule,
  systemModule,
  focusModule,
  screenshotModule,
  screensaverModule,
  quickModule,
  lailaModule,
  achievementsModule,
  ambientModule,
  fortuneModule,
  moodModule,
  proverbModule,
  watchlistModule,
];

export { MODULE_CATEGORIES } from './types';
export type { ModuleCategory, ModuleManifest, ModuleStates } from './types';
