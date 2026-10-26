/** Hatırlatıcı zamanlaması (saf). */

export type ReminderKind = 'eye' | 'water';
export const EYE_OPTIONS = [20, 40, 60] as const;
export const WATER_OPTIONS = [60, 90] as const;
export const SNOOZE_MIN = 5;

export type ReminderClock = Record<ReminderKind, number>;
export type ReminderMinutes = Record<ReminderKind, number>;

export function dueReminder(clock: ReminderClock, now: number, minutes: ReminderMinutes): ReminderKind | null {
  for (const k of ['eye', 'water'] as const) {
    if (now - clock[k] >= minutes[k] * 60_000) return k;
  }
  return null;
}

/** Tamam: sayaç şimdiye döner. */
export function acknowledge(clock: ReminderClock, kind: ReminderKind, now: number): ReminderClock {
  return { ...clock, [kind]: now };
}

/** 5 dk sonra: sayaç, 5 dk sonra tekrar dolacak şekilde geri alınır. */
export function snooze(clock: ReminderClock, kind: ReminderKind, now: number, minutes: ReminderMinutes): ReminderClock {
  return { ...clock, [kind]: now - (minutes[kind] - SNOOZE_MIN) * 60_000 };
}
