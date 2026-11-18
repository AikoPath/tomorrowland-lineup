/**
 * The browser keeps the favourite sets in localStorage. No account is necessary.
 *
 * The key of a set has the festival day and the artists, for example `2026-12-11/amelie-lens+charlotte-de-witte`.
 * The key has no stage and no time, so a favourite stays when the timetable moves a set.
 */
export function favouriteKey(date: string, artistIds: string[]): string {
  return `${date}/${artistIds.join('+')}`;
}

export const FAVOURITES_STORAGE_KEY = 'favourites';
export const HINT_DISMISSED_STORAGE_KEY = 'favourites-hint-dismissed';

/** The heart buttons send this event to the document after each change of the favourites. */
export const FAVOURITES_CHANGE_EVENT = 'favourites-change';

/** The part of the Storage interface that the favourites use. */
export type FavouriteStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Other content in the storage, for example from an old version of the site, gives no favourites. */
export function readFavourites(storage: FavouriteStorage): Set<string> {
  try {
    const value: unknown = JSON.parse(storage.getItem(FAVOURITES_STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((key) => typeof key === 'string') : []);
  } catch {
    return new Set();
  }
}

/** A heart can stand for more than one set, for example all sets of an artist. The heart is on when all its sets are favourites. */
export function isFavourite(favourites: Set<string>, keys: string[]): boolean {
  return keys.every((key) => favourites.has(key));
}

/** Removes the sets when all are favourites, or else adds all the sets. Returns the new favourites. */
export function toggleFavourite(storage: FavouriteStorage, keys: string[]): Set<string> {
  const favourites = readFavourites(storage);
  const remove = isFavourite(favourites, keys);
  for (const key of keys) {
    if (remove) favourites.delete(key);
    else favourites.add(key);
  }
  writeFavourites(storage, favourites);
  return favourites;
}

export function writeFavourites(storage: FavouriteStorage, favourites: Set<string>): void {
  storage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify([...favourites]));
}

/** The message about the device shows when there are favourites, until the user closes it. */
export function isHintShown(storage: FavouriteStorage): boolean {
  return storage.getItem(HINT_DISMISSED_STORAGE_KEY) === null && readFavourites(storage).size > 0;
}

export function dismissHint(storage: FavouriteStorage): void {
  storage.setItem(HINT_DISMISSED_STORAGE_KEY, 'true');
}
