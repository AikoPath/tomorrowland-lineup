import { readFavourites, writeFavourites, type FavouriteStorage } from './favourites.ts';

/**
 * When the user is signed in, the account has the favourites and localStorage keeps a copy.
 * A change goes into a list of pending changes first. The list stays until the account has the change.
 * Thus a change with no network connection, for example in the crowd at the festival, goes to the account later.
 */
export const PENDING_STORAGE_KEY = 'favourites-pending';

/** The same pattern as the set_key check in supabase/migrations/20261118000000_favourites.sql. */
export const SET_KEY_PATTERN = '^\\d{4}-\\d{2}-\\d{2}/[a-z0-9+-]{1,200}$';

export interface FavouriteChange {
  key: string;
  favourite: boolean;
}

/** The favourites in the account of the user who is signed in. */
export interface FavouriteAccount {
  list(): Promise<string[]>;
  add(keys: string[]): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export function readPending(storage: FavouriteStorage): FavouriteChange[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(PENDING_STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter(isChange) : [];
  } catch {
    return [];
  }
}

function isChange(value: unknown): value is FavouriteChange {
  const change = value as FavouriteChange;
  return typeof change?.key === 'string' && typeof change.favourite === 'boolean';
}

function writePending(storage: FavouriteStorage, changes: FavouriteChange[]): void {
  storage.setItem(PENDING_STORAGE_KEY, JSON.stringify(changes));
}

/** A new change of a set replaces the pending change of the same set. */
export function addPending(storage: FavouriteStorage, changes: FavouriteChange[]): void {
  const keys = new Set(changes.map((change) => change.key));
  writePending(storage, [...readPending(storage).filter((change) => !keys.has(change.key)), ...changes]);
}

export function clearPending(storage: FavouriteStorage): void {
  writePending(storage, []);
}

/** After the sign-in, the favourites on the device go to the account. */
export function addDeviceFavouritesToPending(storage: FavouriteStorage): void {
  addPending(
    storage,
    [...readFavourites(storage)].map((key) => ({ key, favourite: true })),
  );
}

/**
 * Sends the pending changes to the account. Then the copy in localStorage gets the favourites of the account.
 * If the network connection stops, the function throws an error and the pending changes stay.
 */
export async function syncFavourites(storage: FavouriteStorage, account: FavouriteAccount): Promise<Set<string>> {
  // The database refuses all changes of a request when it refuses one key. Thus a refused key stops all later syncs.
  const pattern = new RegExp(SET_KEY_PATTERN);
  writePending(
    storage,
    readPending(storage).filter((change) => pattern.test(change.key)),
  );
  const sent = readPending(storage);
  const added = sent.filter((change) => change.favourite).map((change) => change.key);
  const removed = sent.filter((change) => !change.favourite).map((change) => change.key);
  if (added.length > 0) await account.add(added);
  if (removed.length > 0) await account.remove(removed);

  // A click during the sync makes a new pending change. That change stays for the next sync.
  const isSent = (change: FavouriteChange) =>
    sent.some((other) => other.key === change.key && other.favourite === change.favourite);
  writePending(
    storage,
    readPending(storage).filter((change) => !isSent(change)),
  );

  const favourites = new Set(await account.list());
  for (const change of readPending(storage)) {
    if (change.favourite) favourites.add(change.key);
    else favourites.delete(change.key);
  }
  writeFavourites(storage, favourites);
  return favourites;
}

/**
 * The account gets the pending changes before the sign-out, if the network connection lets it.
 * The pending changes go away only after the sign-out succeeds. If the sign-out fails, the user stays signed in and the next sync sends them.
 */
export async function signOutAfterSync(
  storage: FavouriteStorage,
  account: FavouriteAccount,
  signOut: () => Promise<void>,
): Promise<void> {
  await syncFavourites(storage, account).catch(() => {});
  await signOut();
  clearPending(storage);
}
