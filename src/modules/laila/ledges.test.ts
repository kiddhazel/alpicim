import { describe, expect, it } from 'vitest';
import { landingLedge, matchLedge, pickJumpTarget, usableLedges, type Ledge } from './ledges';

const mon = { x: 0, y: 0, width: 1920, height: 1080 };

describe('usableLedges', () => {
  it('çok dar, ekran dışı, tepede ve yerde olanları eler; ekrana kırpar', () => {
    const raw: Ledge[] = [
      { x: 100, y: 400, width: 600 },
      { x: 100, y: 400, width: 40 },
      { x: 100, y: 20, width: 600 },
      { x: 100, y: 1070, width: 600 },
      { x: -200, y: 300, width: 500 },
      { x: 2000, y: 300, width: 500 },
    ];
    expect(usableLedges(raw, mon, 48, 64)).toEqual([
      { x: 100, y: 400, width: 600 },
      { x: 0, y: 300, width: 300 },
    ]);
  });
  it('en çok 30 döner', () => {
    const raw = Array.from({ length: 50 }, (_, i) => ({ x: 0, y: 200 + i, width: 500 }));
    expect(usableLedges(raw, mon, 48, 64)).toHaveLength(30);
  });
});

describe('matchLedge', () => {
  const prev = { x: 100, y: 400, width: 600 };
  it('aynı yerde kalan pencereyi bulur', () => {
    expect(matchLedge(prev, [{ x: 90, y: 402, width: 620 }], 300, 6)).not.toBeNull();
  });
  it('taşınan veya yok olan pencerede null', () => {
    expect(matchLedge(prev, [{ x: 100, y: 450, width: 600 }], 300, 6)).toBeNull();
    expect(matchLedge(prev, [], 300, 6)).toBeNull();
    expect(matchLedge(prev, [{ x: 800, y: 400, width: 300 }], 300, 6)).toBeNull();
  });
});

describe('pickJumpTarget', () => {
  const me = { x: 500, feet: 1080, spriteW: 48, scale: 1 };
  it('erişilebilir çıkıntıyı seçer ve iniş noktasını kırpar', () => {
    const ledge = { x: 600, y: 800, width: 300 };
    const r = pickJumpTarget([ledge], me, null, () => 0);
    expect(r?.ledge).toBe(ledge);
    expect(r?.tx).toBe(600);
  });
  it('çok yüksek, çok uzak, çok alçak ve mevcut olanı atlar', () => {
    expect(pickJumpTarget([{ x: 500, y: 300, width: 300 }], me, null)).toBeNull();
    expect(pickJumpTarget([{ x: 1500, y: 800, width: 300 }], me, null)).toBeNull();
    expect(pickJumpTarget([{ x: 500, y: 1070, width: 300 }], me, null)).toBeNull();
    const cur = { x: 500, y: 800, width: 300 };
    expect(pickJumpTarget([cur], me, cur)).toBeNull();
  });
});

describe('landingLedge', () => {
  it('düşerken yoldaki en yüksek çıkıntıya konar', () => {
    const l = [
      { x: 0, y: 500, width: 400 },
      { x: 0, y: 700, width: 400 },
    ];
    expect(landingLedge(l, 200, 450, 800)?.y).toBe(500);
    expect(landingLedge(l, 900, 450, 800)).toBeNull();
    expect(landingLedge(l, 200, 710, 800)).toBeNull();
  });
});
