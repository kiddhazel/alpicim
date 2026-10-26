import { Lock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t, type MessageKey } from '../../i18n';
import { usePersistentState } from '../../shared/lib/usePersistentState';
import { Card, CardHeader, cx } from '../../shared/ui/primitives';
import { badgeProgress, BADGES, counterValue } from '../achievements/achievements';
import { BADGE_ICONS } from '../achievements/badgeIcons';
import { badgeHint, badgeTitle } from '../achievements/texts';
import { useAchievements } from '../achievements/useAchievements';
import { frameUrls } from '../laila/sprite';
import { daypartForHour } from '../fx/ambient';
import { drawRoom, ROOM_H, ROOM_W } from './drawRoom';
import {
  BOND_KEY,
  bondPoints,
  FURNITURE,
  isUnlocked,
  placedFurniture,
  ROOM_KEY,
  sanitizeRoom,
  toggleFurniture,
  type Daypart,
  type FurnitureDef,
  type RoomLayout,
} from './room';

function useDaypart(): Daypart {
  const [part, setPart] = useState<Daypart>(() => daypartForHour(new Date().getHours()));
  useEffect(() => {
    const id = window.setInterval(() => setPart(daypartForHour(new Date().getHours())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return part;
}

function requirement(def: FurnitureDef): string {
  if (def.points !== undefined) return t('room.needPoints', { n: def.points });
  if (def.badge !== undefined) return t('room.needBadge', { name: badgeTitle(def.badge) });
  return '';
}

/** Laila'nın odası: piksel oda + eşya yerleşimi + rozet galerisi. */
export function RoomPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const daypart = useDaypart();
  const achievements = useAchievements();
  const [bondRaw] = usePersistentState<unknown>(BOND_KEY, null);
  const [layout, setLayout] = usePersistentState<RoomLayout>(ROOM_KEY, { hidden: [] }, sanitizeRoom);
  const [laila, setLaila] = useState<HTMLImageElement | null>(null);
  const points = bondPoints(bondRaw);
  const placed = useMemo(() => placedFurniture(points, achievements, layout), [points, achievements, layout]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setLaila(img);
    img.src = frameUrls().stand;
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawRoom(ctx, { daypart, placed, laila });
  }, [daypart, placed, laila]);

  const unlockedCount = BADGES.filter((b) => achievements.unlocked[b.id] !== undefined).length;

  return (
    <div className="flex h-full min-h-0 flex-wrap gap-4 overflow-y-auto p-4">
      <Card className="flex min-w-[280px] flex-1 basis-[420px] flex-col gap-3 self-start p-4">
        <canvas
          ref={canvasRef}
          width={ROOM_W}
          height={ROOM_H}
          aria-label={t('room.canvasLabel')}
          role="img"
          className="w-full rounded-lg bg-layer"
          style={{ imageRendering: 'pixelated', aspectRatio: `${ROOM_W} / ${ROOM_H}` }}
        />
        <p className="text-sm text-fg-2">{t('room.points', { n: points })}</p>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
          {FURNITURE.map((def) => {
            const open = isUnlocked(def, points, achievements);
            const on = open && !layout.hidden.includes(def.id);
            return (
              <li key={def.id}>
                <button
                  type="button"
                  disabled={!open}
                  aria-pressed={on}
                  onClick={() => setLayout((l) => toggleFurniture(l, def.id))}
                  className={cx(
                    'flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-sm ring-1',
                    on ? 'bg-accent-soft ring-accent' : 'bg-layer ring-stroke',
                    !open && 'text-fg-3',
                  )}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    {!open && <Lock size={12} aria-hidden />}
                    {t(`room.items.${def.id}` as MessageKey)}
                  </span>
                  <span className="text-xs text-fg-3">{open ? (on ? t('room.placed') : t('room.removed')) : requirement(def)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="flex min-w-[260px] flex-1 basis-[300px] flex-col self-start">
        <CardHeader title={t('achievements.title')} subtitle={`${unlockedCount}/${BADGES.length}`} />
        <div className="flex flex-col gap-3 p-4">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          {BADGES.map((b) => {
            const done = achievements.unlocked[b.id] !== undefined;
            const Icon = BADGE_ICONS[b.id];
            const cur = Math.min(b.target, counterValue(achievements, b.counter));
            return (
              <li
                key={b.id}
                title={badgeHint(b.id)}
                className={cx('flex flex-col items-center gap-1 rounded-lg bg-layer px-2 py-3 text-center ring-1 ring-stroke', !done && 'text-fg-3')}
              >
                <Icon size={26} className={done ? 'text-accent' : 'text-fg-3'} aria-hidden />
                <span className={cx('text-sm font-semibold', !done && 'text-fg-3')}>{badgeTitle(b.id)}</span>
                <span className="text-xs text-fg-3">{done ? badgeHint(b.id) : `${cur}/${b.target}`}</span>
                {!done && (
                  <span className="h-1 w-full overflow-hidden rounded bg-control" aria-hidden>
                    <span className="block h-full bg-accent" style={{ width: `${Math.round(badgeProgress(achievements, b) * 100)}%` }} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        </div>
      </Card>
    </div>
  );
}
