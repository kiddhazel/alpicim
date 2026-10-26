/**
 * Laila'nın piksel karakter kareleri (24×32). Kafa ve gövde ayrı çizilir, kareler birleştirilerek üretilir.
 * Her karakter bir renge karşılık gelir; '.' saydamdır. Kareler sağa bakar, sola bakış CSS ile aynalanır.
 */

export const SPRITE_W = 24;
export const SPRITE_H = 32;

export const PALETTE: Record<string, string> = {
  o: '#2a1d3a', // dış çizgi
  h: '#8a5cf6', // saç
  H: '#b79cff', // saç parlaması
  d: '#6a3fd0', // saç gölgesi
  s: '#ffe3d3', // ten
  S: '#f3bfa8', // ten gölgesi
  w: '#ffffff', // göz parlaması
  e: '#29c4d8', // iris
  k: '#1d2440', // göz bebeği / kirpik
  b: '#ff9db5', // allık
  m: '#d9486c', // ağız
  c: '#ff7eb8', // kapüşonlu
  C: '#e2589a', // kapüşonlu gölgesi
  W: '#ffffff', // beyaz şerit / çorap
  f: '#3c3270', // etek
  F: '#2c2556', // etek kıvrımı
  z: '#ff7eb8', // ayakkabı
};

export type FrameId = 'stand' | 'blink' | 'walk' | 'wave' | 'look' | 'happy' | 'sleep';
export const FRAME_IDS: readonly FrameId[] = ['stand', 'blink', 'walk', 'wave', 'look', 'happy', 'sleep'];

const headRow = (inner: string) => `...o${inner}o...`;
const faceRow = (face: string) => headRow(`hh${face}hh`);
const eyes = (left: string, right: string) => `s${left}ssss${right}s`;

interface Face {
  top: string;
  mid: string;
  bottom: string;
  mouth: string;
}

const FACES: Record<'normal' | 'blink' | 'happy' | 'look', Face> = {
  normal: { top: eyes('kkk', 'kkk'), mid: eyes('wee', 'wee'), bottom: eyes('eke', 'eke'), mouth: 'sssssmmsssss' },
  blink: { top: eyes('sss', 'sss'), mid: eyes('kkk', 'kkk'), bottom: eyes('sss', 'sss'), mouth: 'sssssmmsssss' },
  happy: { top: eyes('sks', 'sks'), mid: eyes('ksk', 'ksk'), bottom: eyes('sss', 'sss'), mouth: 'ssssmmmmssss' },
  look: { top: eyes('kkk', 'kkk'), mid: eyes('wee', 'wee'), bottom: eyes('eek', 'eek'), mouth: 'sssssmmsssss' },
};

function head(face: Face): string[] {
  return [
    '........oooooooo........',
    '......oohhhhhhhhoo......',
    '.....ohhhHHHhhhhhho.....',
    '....ohhHHhhhhhhhhhho....',
    headRow('h'.repeat(16)),
    headRow('hhhhshhhhhhshhhh'),
    faceRow('s'.repeat(12)),
    faceRow(face.top),
    faceRow(face.mid),
    faceRow(face.bottom),
    faceRow('sbbssssssbbs'),
    faceRow(face.mouth),
    headRow(`hhhS${'s'.repeat(8)}Shhh`),
    headRow('hhhhhoSSSSohhhhh'),
    headRow('hhhhhhoSSohhhhhh'),
    headRow('dhhhhhoSSohhhhhd'),
  ];
}

const TORSO = [
  '...odhhhoccWWccohhhdo...',
  '...odhhoccccccccohhdo...',
  '....dhocCccccccCcohd....',
  '....dhocCccWWccCcohd....',
  '....d.osCccccccCso.d....',
  '.....ooffffffffffoo.....',
  '....offfFffffffFfffo....',
  '....offFffffffffFffo....',
  '.....oooooooooooooo.....',
];

const WAVE_TORSO = [
  '...odhhhoccWWccohhhdooso',
  '...odhhoccccccccohhdoCo.',
  TORSO[2]!,
  TORSO[3]!,
  '....d.osCccccccCco.d....',
  ...TORSO.slice(5),
];

const LEGS_STAND = [
  '........oso..oso........',
  '........oso..oso........',
  '........oso..oso........',
  '........oWo..oWo........',
  '........oWo..oWo........',
  '.......oozo..ozoo.......',
  '.......oooo..oooo.......',
];

const LEGS_WALK = [
  '.......oso....oso.......',
  '......oso......oso......',
  '......oso......oso......',
  '.....oWo........oWo.....',
  '.....oWo........oWo.....',
  '....oozo........ozoo....',
  '....oooo........oooo....',
];

export const FRAMES: Record<FrameId, readonly string[]> = {
  stand: [...head(FACES.normal), ...TORSO, ...LEGS_STAND],
  blink: [...head(FACES.blink), ...TORSO, ...LEGS_STAND],
  walk: [...head(FACES.normal), ...TORSO, ...LEGS_WALK],
  wave: [...head(FACES.happy), ...WAVE_TORSO, ...LEGS_STAND],
  look: [...head(FACES.look), ...TORSO, ...LEGS_STAND],
  happy: [...head(FACES.happy), ...TORSO, ...LEGS_STAND],
  sleep: [...head(FACES.blink), ...TORSO, ...LEGS_STAND],
};

/** Kare tuval çizimini PNG veri adresine çevirir (tarayıcıda bir kez, sonuç önbelleğe alınır). */
let cache: Record<FrameId, string> | null = null;

export function frameUrls(): Record<FrameId, string> {
  if (cache) return cache;
  const out = {} as Record<FrameId, string>;
  for (const id of FRAME_IDS) {
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_W;
    canvas.height = SPRITE_H;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      FRAMES[id].forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const color = PALETTE[row[x]!];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      });
    }
    out[id] = canvas.toDataURL('image/png');
  }
  cache = out;
  return out;
}
