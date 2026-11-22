/** The scroll position of the timetable and the stage filter bar on one festival day. */
export interface TimetableScroll {
  left: number;
  top: number;
  chipsLeft: number;
}

export const SCROLL_STORAGE_PREFIX = 'timetable-scroll:';

/** The part of the Storage interface that the scroll position uses. */
export type ScrollStorage = Pick<Storage, 'getItem' | 'setItem'>;

function storageKey(date: string): string {
  return `${SCROLL_STORAGE_PREFIX}${date}`;
}

function validOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Gives no position when none was saved for the day, or when the storage has other content. */
export function readScrollPosition(storage: ScrollStorage, date: string): TimetableScroll | undefined {
  try {
    const raw = storage.getItem(storageKey(date));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const { left, top, chipsLeft } = parsed as Record<string, unknown>;
    if (!validOffset(left) || !validOffset(top)) return undefined;
    return { left, top, chipsLeft: validOffset(chipsLeft) ? chipsLeft : 0 };
  } catch {
    return undefined;
  }
}

/** Saves the scroll position for the day. Ignores storage errors, for example when storage is unavailable or full. */
export function saveScrollPosition(storage: ScrollStorage, date: string, position: TimetableScroll): void {
  try {
    storage.setItem(storageKey(date), JSON.stringify(position));
  } catch {
    // The scroll position is only a convenience, so a storage error does not stop the page.
  }
}
