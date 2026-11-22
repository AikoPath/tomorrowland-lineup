/** The scroll position of the timetable on one festival day. */
export interface TimetableScroll {
  left: number;
  top: number;
}

/** The part of the Storage interface that the scroll position uses. */
export type ScrollStorage = Pick<Storage, 'getItem' | 'setItem'>;

function storageKey(date: string): string {
  return `timetable-scroll:${date}`;
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
    const { left, top } = parsed as Record<string, unknown>;
    return validOffset(left) && validOffset(top) ? { left, top } : undefined;
  } catch {
    return undefined;
  }
}

export function saveScrollPosition(storage: ScrollStorage, date: string, position: TimetableScroll): void {
  try {
    storage.setItem(storageKey(date), JSON.stringify(position));
  } catch {
    // Ignore storage errors, for example when storage is unavailable or full.
  }
}
