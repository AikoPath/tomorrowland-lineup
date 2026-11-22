import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readScrollPosition, saveScrollPosition, SCROLL_STORAGE_PREFIX, type ScrollStorage } from './scroll-position.ts';

function memoryStorage(initial: Record<string, string> = {}): ScrollStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

test('reads the scroll position that saveScrollPosition saved for the day', () => {
  const storage = memoryStorage();
  saveScrollPosition(storage, '2026-12-11', { left: 240, top: 680, chipsLeft: 120 });
  assert.deepEqual(readScrollPosition(storage, '2026-12-11'), { left: 240, top: 680, chipsLeft: 120 });
  assert.equal(readScrollPosition(storage, '2026-12-12'), undefined);
});

test('keeps a separate scroll position for each festival day', () => {
  const storage = memoryStorage();
  saveScrollPosition(storage, '2026-12-11', { left: 100, top: 400, chipsLeft: 0 });
  saveScrollPosition(storage, '2026-12-12', { left: 300, top: 900, chipsLeft: 50 });
  assert.deepEqual(readScrollPosition(storage, '2026-12-11'), { left: 100, top: 400, chipsLeft: 0 });
  assert.deepEqual(readScrollPosition(storage, '2026-12-12'), { left: 300, top: 900, chipsLeft: 50 });
});

test('defaults a missing chipsLeft to 0', () => {
  const storage = memoryStorage({ [`${SCROLL_STORAGE_PREFIX}2026-12-11`]: '{"left":10,"top":20}' });
  assert.deepEqual(readScrollPosition(storage, '2026-12-11'), { left: 10, top: 20, chipsLeft: 0 });
});

test('gives no position for invalid or negative values', () => {
  for (const raw of ['not json', 'null', '{}', '{"left":-1,"top":0}', '{"left":"10","top":20}']) {
    const storage = memoryStorage({ [`${SCROLL_STORAGE_PREFIX}2026-12-11`]: raw });
    assert.equal(readScrollPosition(storage, '2026-12-11'), undefined);
  }
});

test('ignores storage errors when reading or saving', () => {
  const broken: ScrollStorage = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('quota exceeded');
    },
  };
  assert.equal(readScrollPosition(broken, '2026-12-11'), undefined);
  assert.doesNotThrow(() => saveScrollPosition(broken, '2026-12-11', { left: 10, top: 20, chipsLeft: 0 }));
});
