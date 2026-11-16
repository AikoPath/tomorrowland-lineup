import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lineup } from '../data/schema.ts';
import { artistListEntries, filterOptions, matchesFilter, searchWords, type ArtistFilter } from './artist-list.ts';

const lineup: Lineup = {
  stages: [
    { id: 'mainstage', name: 'Mainstage' },
    { id: 'freedom', name: 'Freedom' },
    { id: 'core', name: 'Core' },
  ],
  artists: [
    { id: 'amelie-lens', name: 'Amelie Lens', genres: ['techno'] },
    { id: 'charlotte-de-witte', name: 'Charlotte de Witte', genres: ['techno', 'acid techno'] },
    { id: 'dimitri-vegas-like-mike', name: 'Dimitri Vegas & Like Mike', genres: ['big room'] },
    { id: 'halo', name: 'HALŌ' },
  ],
  days: [
    {
      date: '2026-12-11',
      sets: [
        { artists: ['amelie-lens', 'charlotte-de-witte'], stage: 'mainstage', start: '2026-12-11T22:00', end: '2026-12-11T23:30' },
        { artists: ['charlotte-de-witte'], stage: 'freedom', start: '2026-12-12T00:30', end: '2026-12-12T02:00' },
      ],
    },
    {
      date: '2026-12-12',
      sets: [{ artists: ['dimitri-vegas-like-mike'], stage: 'mainstage', start: '2026-12-12T22:00', end: '2026-12-12T23:30' }],
    },
  ],
};

const entries = artistListEntries(lineup);
const noFilter: ArtistFilter = { query: '', date: '', stage: '', genre: '' };

function matchingIds(filter: Partial<ArtistFilter>): string[] {
  return entries.filter((entry) => matchesFilter(entry.filter, { ...noFilter, ...filter })).map((entry) => entry.artist.id);
}

test('artistListEntries gives all artists with their sets, also the artists with no sets', () => {
  const charlotte = entries.find((entry) => entry.artist.id === 'charlotte-de-witte')!;
  assert.deepEqual(charlotte.sets, [
    { date: '2026-12-11', stage: { id: 'mainstage', name: 'Mainstage' } },
    { date: '2026-12-11', stage: { id: 'freedom', name: 'Freedom' } },
  ]);
  assert.deepEqual(charlotte.filter, {
    words: ['charlotte', 'de', 'witte'],
    sets: [
      { date: '2026-12-11', stage: 'mainstage' },
      { date: '2026-12-11', stage: 'freedom' },
    ],
    genres: ['techno', 'acid techno'],
  });
  assert.deepEqual(entries.find((entry) => entry.artist.id === 'halo')!.sets, []);
  assert.equal(entries.length, 4);
});

test('filterOptions gives the days, the stages with sets and the genres in alphabetical order', () => {
  assert.deepEqual(filterOptions(lineup), {
    dates: ['2026-12-11', '2026-12-12'],
    stages: [
      { id: 'mainstage', name: 'Mainstage' },
      { id: 'freedom', name: 'Freedom' },
    ],
    genres: ['acid techno', 'big room', 'techno'],
  });
});

test('searchWords removes accents, case and punctuation', () => {
  assert.deepEqual(searchWords('HALŌ'), ['halo']);
  assert.deepEqual(searchWords('Dimitri Vegas & Like Mike'), ['dimitri', 'vegas', 'like', 'mike']);
  assert.deepEqual(searchWords('  '), []);
});

test('matchesFilter with no filter accepts all artists', () => {
  assert.deepEqual(matchingIds({}), ['amelie-lens', 'charlotte-de-witte', 'dimitri-vegas-like-mike', 'halo']);
});

test('matchesFilter finds an artist by a part of each word of the name', () => {
  assert.deepEqual(matchingIds({ query: 'halo' }), ['halo']);
  assert.deepEqual(matchingIds({ query: 'Witte' }), ['charlotte-de-witte']);
  assert.deepEqual(matchingIds({ query: 'mike dimitri' }), ['dimitri-vegas-like-mike']);
  assert.deepEqual(matchingIds({ query: 'lens witte' }), []);
});

test('matchesFilter finds the artists of a day, a stage and a genre', () => {
  assert.deepEqual(matchingIds({ date: '2026-12-12' }), ['dimitri-vegas-like-mike']);
  assert.deepEqual(matchingIds({ stage: 'freedom' }), ['charlotte-de-witte']);
  assert.deepEqual(matchingIds({ genre: 'techno' }), ['amelie-lens', 'charlotte-de-witte']);
});

test('matchesFilter needs one set that matches the day and the stage', () => {
  assert.deepEqual(matchingIds({ date: '2026-12-11', stage: 'mainstage' }), ['amelie-lens', 'charlotte-de-witte']);
  assert.deepEqual(matchingIds({ date: '2026-12-12', stage: 'freedom' }), []);
});
