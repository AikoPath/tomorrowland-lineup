import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readScrollPosition, saveScrollPosition, type ScrollStorage } from './scroll-position.ts';

function memoryStorage(initial: Record<string, string> = {}): ScrollStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

test('reads the scroll position saved for each festival day', () => {
  const storage = memoryStorage();
  saveScrollPosition(storage, '2026-12-11', { left: 240, top: 680 });
  saveScrollPosition(storage, '2026-12-12', { left: 100, top: 400 });
  assert.deepEqual(readScrollPosition(storage, '2026-12-11'), { left: 240, top: 680 });
  assert.deepEqual(readScrollPosition(storage, '2026-12-12'), { left: 100, top: 400 });
  assert.equal(readScrollPosition(storage, '2026-12-13'), undefined);
});

test('gives no position for invalid or negative values', () => {
  for (const raw of ['not json', 'null', '{}', '{"left":-1,"top":0}', '{"left":"10","top":20}']) {
    const storage = memoryStorage({ 'timetable-scroll:2026-12-11': raw });
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
  assert.doesNotThrow(() => saveScrollPosition(broken, '2026-12-11', { left: 10, top: 20 }));
});
