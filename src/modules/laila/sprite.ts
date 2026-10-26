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

export type FrameId = 'stand' | 'blink' | 'walk' | 'wave' | 'look' | 'happy' | 'sleep' | 'dance1' | 'dance2';
export const FRAME_IDS: readonly FrameId[] = ['stand', 'blink', 'walk', 'wave', 'look', 'happy', 'sleep', 'dance1', 'dance2'];

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
  dance1: [...head(FACES.happy), ...WAVE_TORSO, ...LEGS_WALK],
  dance2: [...head(FACES.happy), ...WAVE_TORSO.map((row) => [...row].reverse().join('')), ...LEGS_WALK],
};

export type OutfitId = 'default' | 'night' | 'strawberry' | 'cat' | 'gold';

export interface OutfitDef {
  id: OutfitId;
  /** Açılması için gereken bağ puanı. */
  points: number;
  /** Palet değişimleri (karakter → renk). */
  colors: Record<string, string>;
  /** Kedi kulakları (kafa satırları 0–1). */
  ears?: boolean;
}

export const OUTFITS: readonly OutfitDef[] = [
  { id: 'default', points: 0, colors: {} },
  {
    id: 'night',
    points: 25,
    colors: { c: '#4f7bd9', C: '#3a5ab0', z: '#4f7bd9', f: '#22294f', F: '#161b3a', h: '#4a5bd6', H: '#8fa0ff', d: '#33409a' },
  },
  {
    id: 'strawberry',
    points: 60,
    colors: { c: '#ff5470', C: '#d63a58', z: '#ff5470', f: '#ffd6df', F: '#f2a9ba', h: '#7a3b2e', H: '#b0705c', d: '#582a20' },
  },
  {
    id: 'cat',
    points: 120,
    ears: true,
    colors: { c: '#f5c26b', C: '#d9a24a', z: '#5b4a3a', f: '#5b4a3a', F: '#43362a', h: '#f0e6d8', H: '#ffffff', d: '#cdbfae' },
  },
  {
    id: 'gold',
    points: 250,
    colors: { c: '#ffcf3f', C: '#e0a516', z: '#ffcf3f', f: '#5a3a2a', F: '#42281c', h: '#ffe27a', H: '#fff6c4', d: '#e0b53a' },
  },
];

export function isOutfitId(v: unknown): v is OutfitId {
  return OUTFITS.some((o) => o.id === v);
}

export function outfitDef(id: OutfitId): OutfitDef {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0]!;
}

const EAR_ROWS = ['.....oo.oooooooo.oo.....', '.....o' + 'h'.repeat(12) + 'o.....'];

/** Kıyafete göre kare satırları (kulaklar satır düzeyinde eklenir). */
export function outfitRows(frame: FrameId, outfit: OutfitId): readonly string[] {
  const rows = FRAMES[frame];
  if (!outfitDef(outfit).ears) return rows;
  return [...EAR_ROWS, ...rows.slice(2)];
}

export type AccessoryId = 'witch' | 'flag' | 'santa' | 'heart';

/** Aksesuar renkleri (kıyafetten bağımsız). */
export const ACC_PALETTE: Record<string, string> = {
  p: '#5b2a86', // cadı şapkası
  P: '#7d3fb5',
  k: '#1a1226',
  r: '#d62839', // yılbaşı şapkası
  w: '#ffffff',
  q: '#ff4d88', // kalp tokası
  R: '#e30a17', // bayrak
  x: '#8a5a2b', // sırık
};

interface AccessoryDef {
  /** [satır, metin] yamaları; '.' saydam. Tuval boyu değişmez. */
  patches: ReadonlyArray<readonly [number, string]>;
  /** Yalnız bu karelerde çizilir (yoksa hepsinde). */
  frames?: readonly FrameId[];
}

export const ACCESSORIES: Record<AccessoryId, AccessoryDef> = {
  santa: {
    patches: [
      [0, '..........rrrr.ww.......'],
      [1, '.......rrrrrrrrrr.......'],
      [2, '......rrrrrrrrrrrr......'],
      [3, '.....wwwwwwwwwwwwww.....'],
    ],
  },
  witch: {
    patches: [
      [0, '..........pp............'],
      [1, '.........pppp...........'],
      [2, '........pPPppppp........'],
      [3, '.....kkkkkkkkkkkkkk.....'],
    ],
  },
  heart: {
    patches: [
      [4, '.....q.q................'],
      [5, '......q.................'],
    ],
  },
  flag: {
    frames: ['wave'],
    patches: [
      [8, '.....................RRx'],
      [9, '.....................wRx'],
      [10, '.....................RRx'],
      [11, '.......................x'],
      [12, '.......................x'],
      [13, '.......................x'],
      [14, '.......................x'],
      [15, '.......................x'],
    ],
  },
};

export function accessoryFor(holiday: string | null): AccessoryId | null {
  switch (holiday) {
    case 'halloween':
      return 'witch';
    case 'republic':
      return 'flag';
    case 'newYear':
    case 'christmas':
      return 'santa';
    case 'valentine':
      return 'heart';
    default:
      return null;
  }
}

const caches = new Map<string, Record<FrameId, string>>();

/** Kare tuval çizimini PNG veri adresine çevirir (tarayıcıda kıyafet başına bir kez, sonuç önbelleğe alınır). */
export function frameUrls(outfit: OutfitId = 'default', accessory: AccessoryId | null = null): Record<FrameId, string> {
  const cacheKey = `${outfit}|${accessory ?? ''}`;
  const hit = caches.get(cacheKey);
  if (hit) return hit;
  const def = outfitDef(outfit);
  const out = {} as Record<FrameId, string>;
  for (const id of FRAME_IDS) {
    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_W;
    canvas.height = SPRITE_H;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      outfitRows(id, outfit).forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x]!;
          const color = def.colors[ch] ?? PALETTE[ch];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      });
      const acc = accessory ? ACCESSORIES[accessory] : null;
      if (acc && (!acc.frames || acc.frames.includes(id))) {
        for (const [y, row] of acc.patches) {
          for (let x = 0; x < row.length; x++) {
            const color = ACC_PALETTE[row[x]!];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
    out[id] = canvas.toDataURL('image/png');
  }
  caches.set(cacheKey, out);
  return out;
}

const HEART = ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
let heartCache: string | null = null;

/** Küçük piksel kalp (7×6). */
export function heartUrl(): string {
  if (heartCache) return heartCache;
  const canvas = document.createElement('canvas');
  canvas.width = 7;
  canvas.height = 6;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    HEART.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        ctx.fillStyle = ch === 'w' ? '#ffd0e0' : '#ff4d88';
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
  heartCache = canvas.toDataURL('image/png');
  return heartCache;
}
