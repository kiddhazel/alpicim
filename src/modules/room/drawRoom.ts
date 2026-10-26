import type { Daypart, FurnitureId } from './room';

export const ROOM_W = 128;
export const ROOM_H = 80;
const FLOOR_Y = 56;

const SKY: Record<Daypart, [string, string]> = {
  dawn: ['#fbc3a7', '#f6e7b4'],
  day: ['#6ec6ff', '#bfe8ff'],
  sunset: ['#f9744b', '#fcc16b'],
  night: ['#0d1330', '#27306b'],
};
const WALL: Record<Daypart, string> = { dawn: '#d9c3e8', day: '#e3d4f5', sunset: '#d7b3d0', night: '#6b5a99' };
const FLOOR: Record<Daypart, string> = { dawn: '#b98a62', day: '#c89a6a', sunset: '#b0805a', night: '#6f5238' };

type Ctx = CanvasRenderingContext2D;

function r(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

const DRAW: Record<FurnitureId, (ctx: Ctx) => void> = {
  rug(ctx) {
    r(ctx, 30, 68, 60, 10, '#e2589a');
    r(ctx, 32, 70, 56, 6, '#ff9db5');
    r(ctx, 36, 72, 48, 2, '#ffe3d3');
  },
  bed(ctx) {
    r(ctx, 2, 44, 32, 14, '#5a3b2a');
    r(ctx, 3, 40, 6, 18, '#7a5238');
    r(ctx, 9, 42, 24, 8, '#ffffff');
    r(ctx, 10, 43, 8, 6, '#cfe3ff');
    r(ctx, 18, 46, 15, 8, '#6a3fd0');
    r(ctx, 18, 46, 15, 2, '#8a5cf6');
    r(ctx, 2, 58, 3, 3, '#3b2518');
    r(ctx, 31, 58, 3, 3, '#3b2518');
  },
  plant(ctx) {
    r(ctx, 94, 50, 10, 8, '#c2603c');
    r(ctx, 93, 49, 12, 2, '#d97752');
    r(ctx, 98, 38, 2, 11, '#2f8f4e');
    r(ctx, 92, 36, 8, 5, '#3fb868');
    r(ctx, 98, 33, 8, 5, '#3fb868');
    r(ctx, 95, 41, 6, 4, '#2f8f4e');
  },
  lamp(ctx) {
    r(ctx, 36, 36, 1, 22, '#4a4a5c');
    r(ctx, 34, 57, 5, 2, '#4a4a5c');
    r(ctx, 33, 30, 7, 7, '#ffd966');
    r(ctx, 34, 31, 5, 5, '#fff2b0');
  },
  poster(ctx) {
    r(ctx, 88, 10, 14, 22, '#2a1d3a');
    r(ctx, 89, 11, 12, 20, '#ff7eb8');
    r(ctx, 91, 14, 8, 8, '#ffe3d3');
    r(ctx, 92, 17, 2, 2, '#1d2440');
    r(ctx, 96, 17, 2, 2, '#1d2440');
    r(ctx, 91, 24, 8, 4, '#8a5cf6');
  },
  bookshelf(ctx) {
    r(ctx, 108, 14, 18, 40, '#6b4630');
    r(ctx, 110, 16, 14, 36, '#4a2f1f');
    const colors = ['#e2589a', '#29c4d8', '#facc15', '#8a5cf6', '#34d399'];
    for (let row = 0; row < 4; row++) {
      const y = 16 + row * 9;
      r(ctx, 110, y + 8, 14, 1, '#6b4630');
      for (let i = 0; i < 5; i++) r(ctx, 111 + i * 2 + (i > 2 ? 1 : 0), y + 2 + (i % 2), 2, 6 - (i % 2), colors[(i + row) % colors.length] ?? '#fff');
    }
  },
  aquarium(ctx) {
    r(ctx, 66, 54, 26, 4, '#5a3b2a');
    r(ctx, 67, 42, 24, 12, '#2a3a5c');
    r(ctx, 68, 43, 22, 10, '#4fb6e8');
    r(ctx, 68, 43, 22, 2, '#8ad4f5');
    r(ctx, 72, 47, 4, 2, '#fb923c');
    r(ctx, 76, 46, 1, 3, '#fb923c');
    r(ctx, 82, 49, 3, 2, '#facc15');
    r(ctx, 86, 50, 2, 3, '#34d399');
    r(ctx, 68, 52, 22, 1, '#e8d9a8');
  },
  gamingpc(ctx) {
    r(ctx, 88, 62, 34, 3, '#3b2f4a');
    r(ctx, 90, 65, 3, 12, '#2a1d3a');
    r(ctx, 117, 65, 3, 12, '#2a1d3a');
    r(ctx, 96, 52, 16, 10, '#14101f');
    r(ctx, 97, 53, 14, 8, '#7c3aed');
    r(ctx, 99, 55, 6, 2, '#22d3ee');
    r(ctx, 103, 62, 2, 1, '#14101f');
    r(ctx, 114, 54, 6, 8, '#1d1b2e');
    r(ctx, 115, 56, 4, 1, '#f472b6');
    r(ctx, 115, 58, 4, 1, '#22d3ee');
    r(ctx, 98, 63, 10, 1, '#f472b6');
  },
};

export interface RoomScene {
  daypart: Daypart;
  placed: readonly FurnitureId[];
  laila: HTMLImageElement | null;
}

/** Odayı 128×80 mantıksal pikselde çizer (tuval CSS ile büyütülür, `image-rendering: pixelated`). */
export function drawRoom(ctx: Ctx, scene: RoomScene): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ROOM_W, ROOM_H);
  r(ctx, 0, 0, ROOM_W, FLOOR_Y, WALL[scene.daypart]);
  r(ctx, 0, FLOOR_Y - 2, ROOM_W, 2, '#00000022');
  r(ctx, 0, FLOOR_Y, ROOM_W, ROOM_H - FLOOR_Y, FLOOR[scene.daypart]);
  for (let x = 0; x < ROOM_W; x += 16) r(ctx, x, FLOOR_Y, 1, ROOM_H - FLOOR_Y, '#00000018');
  drawWindow(ctx, scene.daypart);
  const order: FurnitureId[] = ['poster', 'bookshelf', 'lamp', 'bed', 'aquarium', 'plant', 'rug', 'gamingpc'];
  const wall = order.filter((id) => scene.placed.includes(id));
  for (const id of wall) if (id !== 'gamingpc') DRAW[id](ctx);
  if (scene.laila) ctx.drawImage(scene.laila, 40, 44, 24, 32);
  if (scene.placed.includes('gamingpc')) DRAW.gamingpc(ctx);
}

function drawWindow(ctx: Ctx, part: Daypart) {
  const [top, bottom] = SKY[part];
  r(ctx, 50, 6, 32, 30, '#f4eefc');
  const grad = ctx.createLinearGradient(0, 8, 0, 34);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(52, 8, 28, 26);
  if (part === 'night') {
    for (const [x, y] of [[55, 11], [62, 15], [70, 10], [75, 19], [58, 24]] as const) r(ctx, x, y, 1, 1, '#fff7c2');
    r(ctx, 70, 24, 5, 5, '#f6f1c8');
    r(ctx, 72, 24, 4, 4, '#27306b');
  } else if (part === 'day') {
    r(ctx, 70, 11, 6, 6, '#ffe066');
    r(ctx, 56, 20, 10, 3, '#ffffff');
    r(ctx, 58, 18, 6, 2, '#ffffff');
  } else {
    r(ctx, 62, part === 'dawn' ? 26 : 24, 8, 8, part === 'dawn' ? '#ffd27a' : '#ff8a4c');
    r(ctx, 52, 31, 28, 3, part === 'dawn' ? '#8e7aa8' : '#6a3f6e');
  }
  r(ctx, 65, 8, 2, 26, '#f4eefc');
  r(ctx, 52, 20, 28, 2, '#f4eefc');
  r(ctx, 48, 36, 36, 2, '#d9cdea');
}
