import { useAchievementTracker } from './useAchievements';

/** Kabukta bir kez bağlanan başarım izleyicisi. */
export default function AchievementService() {
  useAchievementTracker();
  return null;
}
