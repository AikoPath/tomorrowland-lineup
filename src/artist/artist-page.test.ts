import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Lineup } from '../data/schema.ts';
import { artistLinks, artistSets, formatDay, formatTime, startsInText } from './artist-page.ts';

const lineup: Lineup = {
  stages: [
    { id: 'mainstage', name: 'Mainstage' },
    { id: 'freedom', name: 'Freedom' },
  ],
  artists: [
    { id: 'amelie-lens', name: 'Amelie Lens' },
    { id: 'charlotte-de-witte', name: 'Charlotte de Witte' },
    { id: 'kolsch', name: 'Kölsch' },
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
      sets: [{ artists: ['kolsch'], stage: 'freedom', start: '2026-12-12T20:00', end: '2026-12-12T21:30' }],
    },
  ],
};

test('artistSets gives each set of the artist with the festival day, the stage and the other B2B artists', () => {
  assert.deepEqual(artistSets(lineup, 'charlotte-de-witte'), [
    {
      key: '2026-12-11/amelie-lens+charlotte-de-witte',
      date: '2026-12-11',
      stage: { id: 'mainstage', name: 'Mainstage' },
      start: '2026-12-11T22:00',
      end: '2026-12-11T23:30',
      otherArtists: [{ id: 'amelie-lens', name: 'Amelie Lens' }],
    },
    {
      key: '2026-12-11/charlotte-de-witte',
      date: '2026-12-11',
      stage: { id: 'freedom', name: 'Freedom' },
      start: '2026-12-12T00:30',
      end: '2026-12-12T02:00',
      otherArtists: [],
    },
  ]);
});

test('artistSets gives no sets for an artist with no set', () => {
  assert.deepEqual(artistSets(lineup, 'unknown'), []);
});

test('artistLinks gives the social links and the music links in a fixed order, with a label for each', () => {
  const links = artistLinks({
    id: 'amelie-lens',
    name: 'Amelie Lens',
    social: { website: 'https://amelielens.com', instagram: 'https://www.instagram.com/amelie_lens' },
    music: { youtube: 'https://www.youtube.com/channel/UCabc', spotify: 'https://open.spotify.com/artist/abc' },
  });
  assert.deepEqual(links, {
    social: [
      { key: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/amelie_lens' },
      { key: 'website', label: 'Website', url: 'https://amelielens.com' },
    ],
    music: [
      { key: 'spotify', label: 'Spotify', url: 'https://open.spotify.com/artist/abc' },
      { key: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/channel/UCabc' },
    ],
  });
});

test('artistLinks gives empty lists when the artist has no links', () => {
  assert.deepEqual(artistLinks({ id: 'kolsch', name: 'Kölsch' }), { social: [], music: [] });
});

test('formatDay gives the short weekday and the date of a festival day', () => {
  assert.equal(formatDay('2026-12-11'), 'Fri 11 Dec');
});

test('formatTime gives the local festival time', () => {
  assert.equal(formatTime('2026-12-12T00:30'), '00:30');
});

test('startsInText gives the hours and the minutes before a set on the same day', () => {
  assert.equal(startsInText('2026-12-11T23:50', '2026-12-11T21:20'), 'Starts in 2 h 30 min');
  assert.equal(startsInText('2026-12-11T23:50', '2026-12-11T21:50'), 'Starts in 2 h');
  assert.equal(startsInText('2026-12-11T23:50', '2026-12-11T23:05'), 'Starts in 45 min');
  assert.equal(startsInText('2026-12-12T00:10', '2026-12-11T23:50'), 'Starts in 20 min');
});

test('startsInText gives the days and the hours before a set on a later day', () => {
  assert.equal(startsInText('2026-12-11T23:50', '2026-11-17T20:50'), 'Starts in 24 d 3 h');
  assert.equal(startsInText('2026-12-11T23:50', '2026-12-10T23:50'), 'Starts in 1 d');
});

test('startsInText gives no text when the set has started', () => {
  assert.equal(startsInText('2026-12-11T23:50', '2026-12-11T23:50'), undefined);
  assert.equal(startsInText('2026-12-11T23:50', '2026-12-12T00:30'), undefined);
});
