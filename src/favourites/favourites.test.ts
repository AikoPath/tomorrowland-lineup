import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadLineup } from '../data/load.ts';
import {
  FAVOURITES_STORAGE_KEY,
  dismissHint,
  favouriteKey,
  isHintShown,
  readFavourites,
  toggleFavourite,
  type FavouriteStorage,
} from './favourites.ts';

function memoryStorage(items: Record<string, string> = {}): FavouriteStorage {
  const map = new Map(Object.entries(items));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

test('makes the key from the day and the artists', () => {
  assert.equal(favouriteKey('2026-12-11', ['amelie-lens', 'charlotte-de-witte']), '2026-12-11/amelie-lens+charlotte-de-witte');
});

test('gives a different key to each set in the lineup data', async () => {
  const lineup = await loadLineup();
  const keys = lineup.days.flatMap((day) => day.sets.map((set) => favouriteKey(day.date, set.artists)));
  assert.equal(new Set(keys).size, keys.length);
});

test('adds a set and removes it again', () => {
  const storage = memoryStorage();
  assert.deepEqual([...toggleFavourite(storage, 'a')], ['a']);
  assert.deepEqual([...toggleFavourite(storage, 'b')], ['a', 'b']);
  assert.deepEqual([...toggleFavourite(storage, 'a')], ['b']);
  assert.deepEqual([...readFavourites(storage)], ['b']);
});

test('gives no favourites for content that is not a list of keys', () => {
  assert.equal(readFavourites(memoryStorage({ [FAVOURITES_STORAGE_KEY]: 'not json' })).size, 0);
  assert.equal(readFavourites(memoryStorage({ [FAVOURITES_STORAGE_KEY]: '{"a":true}' })).size, 0);
  assert.deepEqual([...readFavourites(memoryStorage({ [FAVOURITES_STORAGE_KEY]: '["a",1]' }))], ['a']);
});

test('shows the hint after the first favourite until the user closes it', () => {
  const storage = memoryStorage();
  assert.equal(isHintShown(storage), false);
  toggleFavourite(storage, 'a');
  assert.equal(isHintShown(storage), true);
  dismissHint(storage);
  assert.equal(isHintShown(storage), false);
  toggleFavourite(storage, 'b');
  assert.equal(isHintShown(storage), false);
});
