import { t, type MessageKey } from '../../i18n';
import type { BadgeId } from './achievements';

export function badgeTitle(id: BadgeId): string {
  return t(`achievements.items.${id}.title` as MessageKey);
}

export function badgeHint(id: BadgeId): string {
  return t(`achievements.items.${id}.hint` as MessageKey);
}
