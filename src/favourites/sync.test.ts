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
  const storage = memoryStorage({ [FAVOURITES_STORAGE_KEY]: '["device"]' });
  const account = memoryAccount(['account']);
  addDeviceFavouritesToPending(storage);
  await syncFavourites(storage, account);
  assert.deepEqual([...account.keys].sort(), ['account', 'device']);
  assert.deepEqual([...readFavourites(storage)].sort(), ['account', 'device']);
  assert.deepEqual(readPending(storage), []);
});

test('the device gets a removal that a different device sent to the account', async () => {
  const storage = memoryStorage({ [FAVOURITES_STORAGE_KEY]: '["a","b"]' });
  await syncFavourites(storage, memoryAccount(['a']));
  assert.deepEqual([...readFavourites(storage)], ['a']);
});

test('the account gets a removal from this device', async () => {
  const storage = memoryStorage({ [FAVOURITES_STORAGE_KEY]: '["a","b"]' });
  const account = memoryAccount(['a', 'b']);
  toggleFavourite(storage, ['a']);
  addPending(storage, [{ key: 'a', favourite: false }]);
  await syncFavourites(storage, account);
  assert.deepEqual([...account.keys], ['b']);
  assert.deepEqual([...readFavourites(storage)], ['b']);
});

test('with no network connection, the changes stay pending and the favourites on the device stay', async () => {
  const storage = memoryStorage({ [FAVOURITES_STORAGE_KEY]: '["a"]' });
  addPending(storage, [{ key: 'a', favourite: true }]);
  await assert.rejects(syncFavourites(storage, offlineAccount));
  assert.deepEqual(readPending(storage), [{ key: 'a', favourite: true }]);
  assert.deepEqual([...readFavourites(storage)], ['a']);
});

test('a change during the sync stays pending and shows on the device', async () => {
  const storage = memoryStorage();
  const account = memoryAccount();
  addPending(storage, [{ key: 'a', favourite: true }]);
  const slowAccount: FavouriteAccount = {
    ...account,
    add: async (keys) => {
      await account.add(keys);
      addPending(storage, [{ key: 'b', favourite: true }]);
    },
  };
  await syncFavourites(storage, slowAccount);
  assert.deepEqual([...account.keys], ['a']);
  assert.deepEqual(readPending(storage), [{ key: 'b', favourite: true }]);
  assert.deepEqual([...readFavourites(storage)].sort(), ['a', 'b']);
});

test('the database accepts the key of each set in the lineup data', async () => {
  const sql = await readFile(new URL('../../supabase/favourites.sql', import.meta.url), 'utf8');
  const pattern = new RegExp(sql.match(/set_key ~ '([^']+)'/)![1]);
  const lineup = await loadLineup();
  for (const day of lineup.days) {
    for (const set of day.sets) assert.match(favouriteKey(day.date, set.artists), pattern);
  }
});
