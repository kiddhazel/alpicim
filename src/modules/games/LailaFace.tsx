import { useMemo } from 'react';
import { frameUrls } from '../laila/sprite';

export type FaceMood = 'look' | 'happy' | 'blink';

/** Laila yüzü (piksel) + konuşma balonu, mini oyunlarda tepki verir. */
export function LailaFace({ mood, line }: { mood: FaceMood; line: string }) {
  const urls = useMemo(() => frameUrls(), []);
  return (
    <div className="flex items-center gap-3 rounded-lg bg-control p-2.5">
      <img
        src={urls[mood]}
        alt=""
        width={36}
        height={48}
        className="shrink-0"
        style={{ imageRendering: 'pixelated' }}
        draggable={false}
      />
      <p className="text-sm text-fg" aria-live="polite">{line}</p>
    </div>
  );
}

export function pick<T>(items: readonly T[], rand: () => number = Math.random): T {
  return items[Math.min(items.length - 1, Math.floor(rand() * items.length))] as T;
}
