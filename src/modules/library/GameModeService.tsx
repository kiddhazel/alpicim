import { useSettings } from '../settings/settings';
import { useGameModeSync } from './gameMode';

/** Oyun algılama: oyun açıkken uygulamayı hafifletme eşitlemesi (her pencerede). */
export default function GameModeService() {
  const [settings] = useSettings();
  useGameModeSync(settings.gameModeAuto);
  return null;
}
