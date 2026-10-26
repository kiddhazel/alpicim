import { Clapperboard, Cookie, Smile } from 'lucide-react';
import type { ModuleManifest } from '../../../core/modules/types';

export const fortuneModule: ModuleManifest = {
  id: 'fortune',
  titleKey: 'modules.items.fortune.title',
  descriptionKey: 'modules.items.fortune.description',
  icon: Cookie,
  category: 'fun',
  defaultEnabled: true,
  widgets: ['fortune'],
};

export const moodModule: ModuleManifest = {
  id: 'mood',
  titleKey: 'modules.items.mood.title',
  descriptionKey: 'modules.items.mood.description',
  icon: Smile,
  category: 'fun',
  defaultEnabled: true,
  widgets: ['mood'],
};

export const watchlistModule: ModuleManifest = {
  id: 'watchlist',
  titleKey: 'modules.items.watchlist.title',
  descriptionKey: 'modules.items.watchlist.description',
  icon: Clapperboard,
  category: 'fun',
  defaultEnabled: true,
  widgets: ['watchlist'],
};
