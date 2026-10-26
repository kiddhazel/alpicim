import { useEffect, useRef } from 'react';
import { t } from '../../i18n';
import { readKey, writeKey } from '../../shared/lib/store';
import { TRACK_EVENT, type TrackDetail } from '../../shared/lib/track';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { useToast } from '../../shared/ui/Toast';
import { celebrate } from '../fx/confetti';
import {
  ACHIEVEMENTS_KEY,
  applyTrack,
  EMPTY_ACHIEVEMENTS,
  sanitizeAchievements,
  type AchievementState,
  type BadgeId,
} from './achievements';
import { badgeTitle } from './texts';

export const ACHIEVEMENT_EVENT = 'alpicim:achievement';
const BOND_KEY = 'laila.bond';

/** Salt okunur görünüm (rozet galerisi, oda). */
export function useAchievements(): AchievementState {
  const [state] = usePersistentState<AchievementState>(ACHIEVEMENTS_KEY, EMPTY_ACHIEVEMENTS, sanitizeAchievements);
  return state;
}

/**
 * Kabukta bir kez bağlanır: izleme olaylarını dinler, sayaçları kalıcılaştırır, rozet açılınca
 * bildirim + konfeti + `alpicim:achievement` {id} olayı üretir.
 */
export function useAchievementTracker(): void {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let alive = true;
    let state: AchievementState | null = null;
    // Olaylar sırayla işlenir; ilk yükleme bitmeden gelenler bekler.
    let chain: Promise<void> = readKey<unknown>(ACHIEVEMENTS_KEY, EMPTY_ACHIEVEMENTS)
      .then((raw) => {
        state = sanitizeAchievements(raw);
      })
      .catch(() => {
        state = sanitizeAchievements(null);
      });

    const handle = async (detail: TrackDetail) => {
      if (!alive || !state) return;
      const result = applyTrack(state, detail, Date.now());
      state = result.state;
      await writeKey(ACHIEVEMENTS_KEY, result.state);
      for (const id of result.newlyUnlocked) announce(id);
    };

    const announce = (id: BadgeId) => {
      toastRef.current.push('success', t('achievements.unlocked', { name: badgeTitle(id) }));
      celebrate();
      window.dispatchEvent(new CustomEvent<{ id: BadgeId }>(ACHIEVEMENT_EVENT, { detail: { id } }));
    };

    const onTrack = (e: Event) => {
      const detail = (e as CustomEvent<TrackDetail>).detail;
      if (!detail || typeof detail.counter !== 'string') return;
      chain = chain.then(() => handle(detail)).catch(() => undefined);
    };
    window.addEventListener(TRACK_EVENT, onTrack);

    // Laila serisi bağ kaydından da okunur (olay kaçırılmış olsa bile).
    chain = chain
      .then(async () => {
        const bond = await readKey<unknown>(BOND_KEY, null);
        const days = typeof bond === 'object' && bond !== null ? (bond as Record<string, unknown>).streakDays : 0;
        if (typeof days === 'number' && days > 0) await handle({ counter: 'laila.streakDay', max: days });
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      window.removeEventListener(TRACK_EVENT, onTrack);
    };
  }, []);
}
