import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forgetPickedDay, readPickedDay, savePickedDay } from './picked-day.ts';

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const dates = ['2026-12-11', '2026-12-12', '2026-12-13'];

test('each page gives back the day that it saved', () => {
  const storage = memoryStorage();
  savePickedDay(storage, 'lineup', { date: '2026-12-13' });
  savePickedDay(storage, 'now', { date: '2026-12-12', minute: 21 * 60 });
  assert.deepEqual(readPickedDay(storage, 'lineup', dates), { date: '2026-12-13' });
  assert.deepEqual(readPickedDay(storage, 'now', dates), { date: '2026-12-12', minute: 21 * 60 });
  assert.equal(readPickedDay(storage, 'timeline', dates), undefined);
});

test('gives no day after the page forgets it', () => {
  const storage = memoryStorage();
  savePickedDay(storage, 'now', { date: '2026-12-12', minute: 900 });
  forgetPickedDay(storage, 'now');
  assert.equal(readPickedDay(storage, 'now', dates), undefined);
});

test('gives no day for a date that is not a festival day or for other content', () => {
  const storage = memoryStorage();
  savePickedDay(storage, 'lineup', { date: '2026-12-14' });
  assert.equal(readPickedDay(storage, 'lineup', dates), undefined);
  storage.setItem('picked-day:lineup', 'not json');
  assert.equal(readPickedDay(storage, 'lineup', dates), undefined);
  storage.setItem('picked-day:now', JSON.stringify({ date: '2026-12-12', minute: 'late' }));
  assert.deepEqual(readPickedDay(storage, 'now', dates), { date: '2026-12-12' });
});
