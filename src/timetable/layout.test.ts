import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Artist, Day, Stage } from '../data/schema.ts';
import { dateRangeLabel, dayLabel, dayLabelParts, layoutDay } from './layout.ts';

const stages: Stage[] = [
  { id: 'mainstage', name: 'Mainstage' },
  { id: 'freedom', name: 'Freedom' },
  { id: 'core', name: 'Core' },
];

const artists: Artist[] = [
  { id: 'amelie-lens', name: 'Amelie Lens' },
  {
    id: 'charlotte-de-witte',
    name: 'Charlotte de Witte',
    image: 'https://example.com/charlotte.jpg',
    genres: ['techno', 'acid techno'],
  },
];

const day: Day = {
  date: '2026-12-11',
  sets: [
    { artists: ['charlotte-de-witte'], stage: 'freedom', start: '2026-12-11T13:20', end: '2026-12-11T14:30' },
    { artists: ['amelie-lens', 'charlotte-de-witte'], stage: 'mainstage', start: '2026-12-11T23:30', end: '2026-12-12T01:15' },
  ],
};

test('starts and ends the timetable on a full hour', () => {
  const timetable = layoutDay(day, stages, artists);
  // 13:00 to 02:00
  assert.equal(timetable.length, 13 * 60);
  assert.equal(timetable.hours.length, 13);
  assert.deepEqual(timetable.hours[0], { label: '13:00', offset: 0 });
  assert.deepEqual(timetable.hours.at(-1), { label: '01:00', offset: 12 * 60 });
});

test('places each set in the column of its stage, in the order of the stages', () => {
  const timetable = layoutDay(day, stages, artists);
  assert.deepEqual(
    timetable.columns.map((column) => column.stage.id),
    ['mainstage', 'freedom'],
  );
  const [mainstage, freedom] = timetable.columns;
  assert.deepEqual(freedom.sets[0], {
    key: '2026-12-11/charlotte-de-witte',
    artists: [artists[1]],
    offset: 20,
    length: 70,
    start: '13:20',
    end: '14:30',
    image: 'https://example.com/charlotte.jpg',
    genre: 'techno',
  });
  assert.equal(mainstage.sets[0].offset, 10 * 60 + 30);
  assert.equal(mainstage.sets[0].length, 105);
  assert.equal(mainstage.sets[0].end, '01:15');
});

test('keeps all artists of a B2B set in order', () => {
  const [mainstage] = layoutDay(day, stages, artists).columns;
  assert.deepEqual(
    mainstage.sets[0].artists.map((artist) => artist.name),
    ['Amelie Lens', 'Charlotte de Witte'],
  );
});

test('takes the image and the genre from the first B2B artist that has them', () => {
  const [mainstage] = layoutDay(day, stages, artists).columns;
  assert.equal(mainstage.sets[0].image, 'https://example.com/charlotte.jpg');
  assert.equal(mainstage.sets[0].genre, 'techno');
});

test('gives no image and no genre to a set of artists with no image and no genre', () => {
  const soloDay: Day = {
    date: '2026-12-11',
    sets: [{ artists: ['amelie-lens'], stage: 'core', start: '2026-12-11T13:00', end: '2026-12-11T14:00' }],
  };
  const [core] = layoutDay(soloDay, stages, artists).columns;
  assert.equal('image' in core.sets[0], false);
  assert.equal('genre' in core.sets[0], false);
});

test('returns an empty timetable for a day with no sets', () => {
  assert.deepEqual(layoutDay({ date: '2026-12-11', sets: [] }, stages, artists), { columns: [], hours: [], length: 0 });
});

test('labels a day with the weekday, day and month', () => {
  assert.equal(dayLabel('2026-12-11'), 'Fri 11 Dec');
});

test('splits the day label into the weekday and the date', () => {
  assert.deepEqual(dayLabelParts('2026-12-11'), { weekday: 'Fri', dayAndMonth: '11 Dec' });
});

test('labels a range of festival days', () => {
  assert.equal(dateRangeLabel('2026-12-11', '2026-12-13'), '11–13 Dec 2026');
  assert.equal(dateRangeLabel('2026-12-11', '2026-12-11'), '11 Dec 2026');
  assert.equal(dateRangeLabel('2026-11-30', '2026-12-02'), '30 Nov 2026 – 2 Dec 2026');
  assert.equal(dateRangeLabel('2026-12-31', '2027-01-02'), '31 Dec 2026 – 2 Jan 2027');
});
