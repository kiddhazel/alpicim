import { describe, expect, it } from 'vitest';
import { FRAME_IDS, FRAMES, PALETTE, SPRITE_H, SPRITE_W } from './sprite';

describe('Laila kareleri', () => {
  for (const id of FRAME_IDS) {
    it(`${id} karesi ${SPRITE_H} satır, her satır ${SPRITE_W} karakter`, () => {
      const rows = FRAMES[id];
      expect(rows).toHaveLength(SPRITE_H);
      rows.forEach((row) => expect(row).toHaveLength(SPRITE_W));
    });

    it(`${id} karesi yalnız '.' ve palet anahtarları içerir`, () => {
      for (const row of FRAMES[id]) {
        for (const ch of row) {
          expect(ch === '.' || Object.prototype.hasOwnProperty.call(PALETTE, ch)).toBe(true);
        }
      }
    });
  }
});
