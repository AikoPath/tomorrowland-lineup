/**
 * Each page remembers the day that the user picked, for the app session.
 * The Back button and the main navigation then open the same day again.
 */
export interface PickedDay {
  /** `YYYY-MM-DD` */
  date: string;
  /** The time on the Now page, in minutes from 00:00 on `date`. */
  minute?: number;
}

export type PickedDayPage = 'lineup' | 'timeline' | 'now';

/** The part of the Storage interface that the picked day uses. */
export type PickedDayStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function pickedDayKey(page: PickedDayPage): string {
  return `picked-day:${page}`;
}

/** Gives no day when none was saved, when the day is not in `dates`, or when the storage has other content. */
export function readPickedDay(storage: PickedDayStorage, page: PickedDayPage, dates: string[]): PickedDay | undefined {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(pickedDayKey(page)) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const { date, minute } = parsed as Record<string, unknown>;
    if (typeof date !== 'string' || !dates.includes(date)) return undefined;
    return typeof minute === 'number' && Number.isInteger(minute) ? { date, minute } : { date };
  } catch {
    return undefined;
  }
}

export function savePickedDay(storage: PickedDayStorage, page: PickedDayPage, day: PickedDay): void {
  try {
    storage.setItem(pickedDayKey(page), JSON.stringify(day));
  } catch {
    // Ignore storage errors, for example when storage is unavailable or full.
  }
}

export function forgetPickedDay(storage: PickedDayStorage, page: PickedDayPage): void {
  try {
    storage.removeItem(pickedDayKey(page));
  } catch {
    // Ignore storage errors, for example when storage is unavailable.
  }
}
