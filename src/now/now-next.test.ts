import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lineup } from '../data/schema.ts';
import {
  clampTime,
  clockLabel,
  festivalNow,
  festivalPosition,
  initials,
  nowDays,
  stageState,
  timeLeftLabel,
} from './now-next.ts';

const lineup: Lineup = {
  stages: [
    { id: 'mainstage', name: 'Mainstage' },
    { id: 'freedom', name: 'Freedom' },
    { id: 'core', name: 'Core' },
  ],
  artists: [
    { id: 'amelie-lens', name: 'Amelie Lens', image: 'https://artist-lineup-cdn.tomorrowland.com/amelie.png' },
    { id: 'aly-fila', name: 'Aly & Fila' },
    { id: 'charlotte-de-witte', name: 'Charlotte de Witte' },
  ],
  days: [
    {
      date: '2026-12-11',
      sets: [
        { artists: ['aly-fila'], stage: 'freedom', start: '2026-12-11T13:00', end: '2026-12-11T14:30' },
        { artists: ['amelie-lens'], stage: 'mainstage', start: '2026-12-11T22:00', end: '2026-12-11T23:30' },
        {
          artists: ['amelie-lens', 'charlotte-de-witte'],
          stage: 'mainstage',
          start: '2026-12-11T23:30',
          end: '2026-12-12T01:00',
        },
      ],
    },
    {
      date: '2026-12-12',
      sets: [{ artists: ['aly-fila'], stage: 'core', start: '2026-12-12T14:00', end: '2026-12-12T15:00' }],
    },
    { date: '2026-12-13', sets: [] },
  ],
};

const days = nowDays(lineup);
const [friday, saturday] = days;
const [mainstage, freedom] = friday.stages;

test('keeps only the days and the stages with sets, in data order', () => {
  assert.deepEqual(
    days.map((day) => day.label),
    ['Fri 11 Dec', 'Sat 12 Dec'],
  );
  assert.deepEqual(
    friday.stages.map((stage) => stage.name),
    ['Mainstage', 'Freedom'],
  );
});

test('counts the minutes from 00:00 on the festival day, also after midnight', () => {
  assert.equal(friday.start, 13 * 60);
  assert.equal(friday.end, 25 * 60);
  assert.deepEqual(
    mainstage.sets.map(({ start, end }) => [start, end]),
    [
      [22 * 60, 23 * 60 + 30],
      [23 * 60 + 30, 25 * 60],
    ],
  );
});

test('gives each artist a link, the photo and the initials', () => {
  assert.deepEqual(mainstage.sets[1].artists, [
    { name: 'Amelie Lens', url: '/artists/amelie-lens/', image: '/photos/tml/amelie.png?width=400', initials: 'AL' },
    { name: 'Charlotte de Witte', url: '/artists/charlotte-de-witte/', initials: 'CD' },
  ]);
});

test('makes initials from the first two words with a letter or a digit', () => {
  assert.equal(initials('Aly & Fila'), 'AF');
  assert.equal(initials('X CLUB.'), 'XC');
  assert.equal(initials('22 Bullets'), '2B');
  assert.equal(initials('Kölsch'), 'K');
});

test('shows the current set with its progress and the next set', () => {
  const state = stageState(mainstage, 22 * 60 + 30);
  assert.equal(state.current?.set, mainstage.sets[0]);
  assert.equal(state.current?.progress, 1 / 3);
  assert.equal(state.current?.minutesLeft, 60);
  assert.equal(state.next, mainstage.sets[1]);
});

test('starts the next set at its start minute', () => {
  const state = stageState(mainstage, 23 * 60 + 30);
  assert.equal(state.current?.set, mainstage.sets[1]);
  assert.equal(state.current?.progress, 0);
  assert.equal(state.next, undefined);
});

test('shows no current set between sets and no next set after the last set', () => {
  assert.deepEqual(stageState(mainstage, 15 * 60), { next: mainstage.sets[0] });
  assert.deepEqual(stageState(freedom, 14 * 60 + 30), {});
});

test('opens at the current time during a festival day, also after midnight', () => {
  assert.deepEqual(festivalPosition(days, '2026-12-11T21:20'), { dayIndex: 0, minute: 21 * 60 + 20 });
  assert.deepEqual(festivalPosition(days, '2026-12-12T00:40'), { dayIndex: 0, minute: 24 * 60 + 40 });
});

test('opens at the start of the next day before a festival day', () => {
  assert.deepEqual(festivalPosition(days, '2026-11-17T10:00'), { dayIndex: 0, minute: 13 * 60 });
  assert.deepEqual(festivalPosition(days, '2026-12-12T01:00'), { dayIndex: 1, minute: 14 * 60 });
});

test('opens at the start of the first day after the festival', () => {
  assert.deepEqual(festivalPosition(days, '2026-12-12T15:00'), { dayIndex: 0, minute: 13 * 60 });
});

test('keeps the time between the first start and the last end of the day', () => {
  assert.equal(clampTime(saturday, 13 * 60), 14 * 60);
  assert.equal(clampTime(saturday, 16 * 60), 15 * 60);
  assert.equal(clampTime(saturday, 14 * 60 + 30), 14 * 60 + 30);
});

test('gives the local time in the festival time zone', () => {
  // 14:30 UTC is 21:30 in Thailand.
  assert.equal(festivalNow(new Date('2026-12-11T14:30:00Z'), 'Asia/Bangkok'), '2026-12-11T21:30');
  assert.equal(festivalNow(new Date('2026-12-11T17:05:00Z'), 'Asia/Bangkok'), '2026-12-12T00:05');
});

test('writes the clock time and the time left', () => {
  assert.equal(clockLabel(21 * 60 + 5), '21:05');
  assert.equal(clockLabel(24 * 60 + 30), '00:30');
  assert.equal(timeLeftLabel(70), '1 h 10 min left');
  assert.equal(timeLeftLabel(60), '1 h left');
  assert.equal(timeLeftLabel(45), '45 min left');
});
