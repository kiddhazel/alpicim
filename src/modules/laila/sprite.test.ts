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

describe('Laila aksesuarları', () => {
  it('yamalar 24 karakter, tuval içinde ve geçerli renklerle', async () => {
    const { ACCESSORIES, ACC_PALETTE, accessoryFor } = await import('./sprite');
    for (const acc of Object.values(ACCESSORIES)) {
      for (const [y, row] of acc.patches) {
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(SPRITE_H);
        expect(row).toHaveLength(SPRITE_W);
        for (const ch of row) expect(ch === '.' || ch in ACC_PALETTE).toBe(true);
      }
    }
    expect(accessoryFor('republic')).toBe('flag');
    expect(accessoryFor('christmas')).toBe('santa');
    expect(accessoryFor(null)).toBeNull();
  });
});

describe('Laila kıyafetleri', () => {
  it('kedi kulaklı kareler de 24×32 kalır ve geçerli karakterler içerir', async () => {
    const { outfitRows, OUTFITS } = await import('./sprite');
    for (const o of OUTFITS) {
      for (const id of FRAME_IDS) {
        const rows = outfitRows(id, o.id);
        expect(rows).toHaveLength(SPRITE_H);
        rows.forEach((row) => {
          expect(row).toHaveLength(SPRITE_W);
          for (const ch of row) expect(ch === '.' || ch in PALETTE).toBe(true);
        });
      }
    }
  });
});
