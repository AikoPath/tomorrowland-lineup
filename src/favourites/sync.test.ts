import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadLineup } from '../data/load.ts';
import {
  FAVOURITES_STORAGE_KEY,
  favouriteKey,
  readFavourites,
  toggleFavourite,
  type FavouriteStorage,
} from './favourites.ts';
import {
  addDeviceFavouritesToPending,
  addPending,
  readPending,
  SET_KEY_PATTERN,
  signOutAfterSync,
  syncFavourites,
  type FavouriteAccount,
} from './sync.ts';

function memoryStorage(items: Record<string, string> = {}): FavouriteStorage {
  const map = new Map(Object.entries(items));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

function memoryAccount(keys: string[] = []): FavouriteAccount & { keys: Set<string> } {
  const account = {
    keys: new Set(keys),
    list: async () => [...account.keys],
    add: async (added: string[]) => added.forEach((key) => account.keys.add(key)),
    remove: async (removed: string[]) => removed.forEach((key) => account.keys.delete(key)),
  };
  return account;
}

const A = '2026-07-17/a';
const B = '2026-07-17/b';
const DEVICE = '2026-07-18/device';
const ACCOUNT = '2026-07-18/account';

const offlineAccount: FavouriteAccount = {
  list: () => Promise.reject(new Error('offline')),
  add: () => Promise.reject(new Error('offline')),
  remove: () => Promise.reject(new Error('offline')),
};

test('a new change of a set replaces the pending change of the same set', () => {
  const storage = memoryStorage();
  addPending(storage, [{ key: 'a', favourite: true }]);
  addPending(storage, [{ key: 'b', favourite: true }]);
  addPending(storage, [{ key: 'a', favourite: false }]);
  assert.deepEqual(readPending(storage), [
    { key: 'b', favourite: true },
    { key: 'a', favourite: false },
  ]);
});

test('other content in the pending storage gives no pending changes', () => {
  assert.deepEqual(readPending(memoryStorage({ 'favourites-pending': '{' })), []);
  assert.deepEqual(readPending(memoryStorage({ 'favourites-pending': '[{"key":1}]' })), []);
});

test('after the sign-in, the favourites on the device go to the account', async () => {
  const storage = memoryStorage({ [FAVOURITES_STORAGE_KEY]: JSON.stringify([DEVICE]) });
  const account = memoryAccount([ACCOUNT]);
  addDeviceFavouritesToPending(storage);
  await syncFavourites(storage, account);
  assert.deepEqual([...account.keys].sort(), [ACCOUNT, DEVICE]);
  assert.deepEqual([...readFavourites(storage)].sort(), [ACCOUNT, DEVICE]);
  assert.deepEqual(readPending(storage), []);
});

test('the device gets a removal that a different device sent to the account', async () => {
  const storage = memoryStorage({ [FAVOURITES_STORAGE_KEY]: JSON.stringify([A, B]) });
  await syncFavourites(storage, memoryAccount([A]));
  assert.deepEqual([...readFavourites(storage)], [A]);
});

test('the account gets a removal from this device', async () => {
  const storage = memoryStorage({ [FAVOURITES_STORAGE_KEY]: JSON.stringify([A, B]) });
  const account = memoryAccount([A, B]);
  toggleFavourite(storage, [A]);
  addPending(storage, [{ key: A, favourite: false }]);
  await syncFavourites(storage, account);
  assert.deepEqual([...account.keys], [B]);
  assert.deepEqual([...readFavourites(storage)], [B]);
});

test('with no network connection, the changes stay pending and the favourites on the device stay', async () => {
  const storage = memoryStorage({ [FAVOURITES_STORAGE_KEY]: JSON.stringify([A]) });
  addPending(storage, [{ key: A, favourite: true }]);
  await assert.rejects(syncFavourites(storage, offlineAccount));
  assert.deepEqual(readPending(storage), [{ key: A, favourite: true }]);
  assert.deepEqual([...readFavourites(storage)], [A]);
});

test('a change during the sync stays pending and shows on the device', async () => {
  const storage = memoryStorage();
  const account = memoryAccount();
  addPending(storage, [{ key: A, favourite: true }]);
  const slowAccount: FavouriteAccount = {
    ...account,
    add: async (keys) => {
      await account.add(keys);
      addPending(storage, [{ key: B, favourite: true }]);
    },
  };
  await syncFavourites(storage, slowAccount);
  assert.deepEqual([...account.keys], [A]);
  assert.deepEqual(readPending(storage), [{ key: B, favourite: true }]);
  assert.deepEqual([...readFavourites(storage)].sort(), [A, B]);
});

test('the sync does not send a key that the database refuses, and the other changes go to the account', async () => {
  const storage = memoryStorage();
  const account = memoryAccount();
  const strictAccount: FavouriteAccount = {
    ...account,
    add: async (keys) => {
      if (!keys.every((key) => new RegExp(SET_KEY_PATTERN).test(key))) throw new Error('check constraint');
      await account.add(keys);
    },
  };
  addPending(storage, [
    { key: 'old-key', favourite: true },
    { key: A, favourite: true },
  ]);
  await syncFavourites(storage, strictAccount);
  assert.deepEqual([...account.keys], [A]);
  assert.deepEqual(readPending(storage), []);
  assert.deepEqual([...readFavourites(storage)], [A]);
});

test('the sync uses the same key pattern as the database', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/20261118000000_favourites.sql', import.meta.url), 'utf8');
  assert.equal(sql.match(/set_key ~ '([^']+)'/)![1], SET_KEY_PATTERN);
});

test('before the sign-out, the account gets the pending changes', async () => {
  const storage = memoryStorage();
  const account = memoryAccount();
  addPending(storage, [{ key: A, favourite: true }]);
  await signOutAfterSync(storage, account, async () => {});
  assert.deepEqual([...account.keys], [A]);
  assert.deepEqual(readPending(storage), []);
});

test('with no network connection, the sign-out continues and the pending changes go away', async () => {
  const storage = memoryStorage();
  addPending(storage, [{ key: A, favourite: true }]);
  await signOutAfterSync(storage, offlineAccount, async () => {});
  assert.deepEqual(readPending(storage), []);
});

test('when the sign-out fails, the pending changes stay', async () => {
  const storage = memoryStorage();
  addPending(storage, [{ key: A, favourite: true }]);
  await assert.rejects(
    signOutAfterSync(storage, offlineAccount, () => Promise.reject(new Error('offline'))),
  );
  assert.deepEqual(readPending(storage), [{ key: A, favourite: true }]);
});

test('the database accepts the key of each set in the lineup data', async () => {
  const pattern = new RegExp(SET_KEY_PATTERN);
  const lineup = await loadLineup();
  for (const day of lineup.days) {
    for (const set of day.sets) assert.match(favouriteKey(day.date, set.artists), pattern);
  }
});
