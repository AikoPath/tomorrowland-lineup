import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lineup } from '../data/schema.ts';
import { activeDayIndex, initialDate, overlapMinutes, setCountLabel, timelineDays } from './timeline.ts';

const lineup: Lineup = {
  stages: [
    { id: 'mainstage', name: 'Mainstage' },
    { id: 'freedom', name: 'Freedom' },
  ],
  artists: [
    { id: 'amelie-lens', name: 'Amelie Lens', image: 'https://example.com/amelie.png' },
    { id: 'aly-fila', name: 'Aly & Fila' },
    { id: 'charlotte-de-witte', name: 'Charlotte de Witte', image: 'https://example.com/charlotte.png' },
  ],
  days: [
    {
      date: '2026-12-11',
      sets: [
        {
          artists: ['aly-fila', 'charlotte-de-witte'],
          stage: 'freedom',
          start: '2026-12-11T23:30',
          end: '2026-12-12T01:00',
        },
        { artists: ['aly-fila'], stage: 'freedom', start: '2026-12-11T22:00', end: '2026-12-11T23:30' },
        { artists: ['amelie-lens'], stage: 'mainstage', start: '2026-12-11T22:00', end: '2026-12-11T23:00' },
      ],
    },
    { date: '2026-12-12', sets: [] },
  ],
};

test('lists the sets of each day in start order, and in stage order at the same start', () => {
  const [day] = timelineDays(lineup);
  assert.deepEqual(
    day.sets.map((set) => [set.start, set.stageName]),
    [
      ['2026-12-11T22:00', 'Mainstage'],
      ['2026-12-11T22:00', 'Freedom'],
      ['2026-12-11T23:30', 'Freedom'],
    ],
  );
});

test('gives each set its key, its artists and the image of the first artist with an image', () => {
  const b2b = timelineDays(lineup)[0].sets[2];
  assert.equal(b2b.key, '2026-12-11/aly-fila+charlotte-de-witte');
  assert.deepEqual(
    b2b.artists.map((artist) => artist.name),
    ['Aly & Fila', 'Charlotte de Witte'],
  );
  assert.equal(b2b.image, 'https://example.com/charlotte.png');
  assert.equal(timelineDays(lineup)[0].sets[1].image, undefined);
});

test('gives the end of the last set after midnight as the end of the day', () => {
  assert.equal(timelineDays(lineup)[0].end, '2026-12-12T01:00');
});

test('leaves out a day with no sets', () => {
  assert.deepEqual(
    timelineDays(lineup).map((day) => day.date),
    ['2026-12-11'],
  );
});

test('gives the minutes that two sets overlap', () => {
  const set = (start: string, end: string) => ({ start: `2026-12-11T${start}`, end: `2026-12-11T${end}` });
  assert.equal(overlapMinutes(set('21:00', '22:00'), set('21:45', '22:45')), 15);
  assert.equal(overlapMinutes(set('20:00', '23:00'), set('21:00', '22:00')), 60);
  assert.equal(overlapMinutes(set('21:00', '22:00'), set('22:00', '23:00')), 0);
  assert.equal(overlapMinutes(set('21:00', '22:00'), set('22:30', '23:00')), 0);
});

test('gives the overlap of sets after midnight', () => {
  assert.equal(
    overlapMinutes(
      { start: '2026-12-11T23:00', end: '2026-12-12T00:30' },
      { start: '2026-12-12T00:00', end: '2026-12-12T01:00' },
    ),
    30,
  );
});

test('gives the count of sets and the weekday', () => {
  assert.equal(setCountLabel(6, '2026-12-11'), '6 sets on Friday');
  assert.equal(setCountLabel(1, '2026-12-12'), '1 set on Saturday');
  assert.equal(setCountLabel(0, '2026-12-13'), '0 sets on Sunday');
});

const days = [
  { date: '2026-12-11', end: '2026-12-12T01:00' },
  { date: '2026-12-12', end: '2026-12-13T01:00' },
  { date: '2026-12-13', end: '2026-12-14T00:00' },
];

test('opens at the current festival day during the festival', () => {
  const favouriteDates = new Set(['2026-12-13']);
  assert.equal(initialDate(days, '2026-12-11T15:00', favouriteDates), '2026-12-11');
  assert.equal(initialDate(days, '2026-12-12T00:30', favouriteDates), '2026-12-11');
  assert.equal(initialDate(days, '2026-12-12T09:00', favouriteDates), '2026-12-12');
});

test('opens at the first day with a favourite before and after the festival', () => {
  const favouriteDates = new Set(['2026-12-12', '2026-12-13']);
  assert.equal(initialDate(days, '2026-11-18T10:00', favouriteDates), '2026-12-12');
  assert.equal(initialDate(days, '2026-12-14T09:00', favouriteDates), '2026-12-12');
});

test('opens at the first day when there are no favourites', () => {
  assert.equal(initialDate(days, '2026-11-18T10:00', new Set()), '2026-12-11');
});

test('finds the active day panel from the horizontal scroll position', () => {
  assert.equal(activeDayIndex(0, 400, 3), 0);
  assert.equal(activeDayIndex(-40, 400, 3), 0);
  assert.equal(activeDayIndex(199, 400, 3), 0);
  assert.equal(activeDayIndex(200, 400, 3), 1);
  assert.equal(activeDayIndex(400, 400, 3), 1);
  assert.equal(activeDayIndex(850, 400, 3), 2);
  assert.equal(activeDayIndex(400, 0, 3), 0);
  assert.equal(activeDayIndex(400, 400, 1), 0);
});
