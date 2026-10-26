import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '../../shared/lib/tauri';

/** Rust → `alpicim://game-mode` */
export const GAME_MODE_TAURI_EVENT = 'alpicim://game-mode';
/** Pencere içi olay (Laila, FX vb. dinler): detail = { active, name } */
export const GAME_MODE_EVENT = 'alpicim:game-mode';

export interface GameModePayload {
  active: boolean;
  name: string;
}

export function sanitizeGameMode(raw: unknown): GameModePayload {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { active: r.active === true, name: typeof r.name === 'string' ? r.name.slice(0, 80) : '' };
}

/** Oyun modu açık mı? (otomatik algılama kapalıysa her zaman kapalı) */
export function effectiveGameMode(auto: boolean, payload: GameModePayload): GameModePayload {
  return auto ? payload : { active: false, name: '' };
}

export function isGameModeOn(): boolean {
  return document.documentElement.dataset.game === 'on';
}

function apply(payload: GameModePayload) {
  const prev = isGameModeOn();
  if (payload.active) document.documentElement.dataset.game = 'on';
  else delete document.documentElement.dataset.game;
  if (prev !== payload.active) {
    window.dispatchEvent(new CustomEvent<GameModePayload>(GAME_MODE_EVENT, { detail: payload }));
  }
}

/** Kök bileşende bir kez: Rust olayını `<html data-game>` + pencere olayına çevirir. */
export function useGameModeSync(auto: boolean) {
  useEffect(() => {
    if (!auto) {
      apply({ active: false, name: '' });
      return;
    }
    if (!isTauri()) return;
    let off: (() => void) | undefined;
    let alive = true;
    void listen<unknown>(GAME_MODE_TAURI_EVENT, (e) => apply(effectiveGameMode(auto, sanitizeGameMode(e.payload)))).then((u) => {
      if (alive) off = u;
      else u();
    });
    return () => {
      alive = false;
      off?.();
    };
  }, [auto]);
}

/** Bileşenlerde: oyun modu açık mı? */
export function useGameMode(): boolean {
  const [on, setOn] = useState(isGameModeOn);
  useEffect(() => {
    const h = (e: Event) => setOn((e as CustomEvent<GameModePayload>).detail?.active === true);
    window.addEventListener(GAME_MODE_EVENT, h);
    setOn(isGameModeOn());
    return () => window.removeEventListener(GAME_MODE_EVENT, h);
  }, []);
  return on;
}
