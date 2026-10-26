/** Palet vb. yerlerden Laila'yı tetiklemek için pencere olayları. */
export const LAILA_CHAT_EVENT = 'alpicim:laila-chat';
export const LAILA_LEAVE_EVENT = 'alpicim:laila-leave';
/** Laila oyun oynamak istediğinde yayılır; Oyunlar paneli dinler. */
export const LAILA_PLAY_EVENT = 'alpicim:laila-play';
/** Oyun bitince Oyunlar panelinin yaydığı olay; detail: LailaPlayEnd. */
export const LAILA_PLAY_END_EVENT = 'alpicim:laila-play-end';

/** Pomodoro widget'ı çalışma evresi bitince yayar. */
export const POMODORO_DONE_EVENT = 'alpicim:pomodoro-done';

export interface LailaPlayEnd {
  game: string;
  result: 'win' | 'lose' | 'stopped';
  score?: number;
}
