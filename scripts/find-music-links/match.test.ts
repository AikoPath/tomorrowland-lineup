import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  itunesCandidates,
  pickMatch,
  sameName,
  sharedNames,
  spotifyCandidates,
  youtubeCandidates,
  type Candidate,
} from './match.ts';

function candidate(name: string, genres: string[] = [], url = `https://example.com/${name}`): Candidate {
  return { name, url, genres };
}

test('compares names without case, accents, punctuation and "and"', () => {
  assert.ok(sameName('AFROJACK', 'Afrojack'));
  assert.ok(sameName('Kölsch', 'Kolsch'));
  assert.ok(sameName('Dimitri Vegas and Like Mike', 'Dimitri Vegas & Like Mike'));
  assert.ok(!sameName('Afrojack & Mougleta', 'Afrojack'));
  assert.ok(!sameName('!!', '??'));
});

test('selects the only candidate with the same name', () => {
  const match = pickMatch('Afrojack', [candidate('Afro Jack', ['Latin']), candidate('AFROJACK', ['Pop'])]);
  assert.equal(match?.name, 'AFROJACK');
});

test('selects the first electronic candidate when 2 or more have the same name', () => {
  const match = pickMatch('Halo', [
    candidate('Halo', ['Hip-Hop/Rap']),
    candidate('HaLo', ['House']),
    candidate('HALO', ['Dance']),
  ]);
  assert.equal(match?.name, 'HaLo');
});

test('selects no candidate when 2 or more have the same name and none is electronic', () => {
  assert.equal(pickMatch('Halo', [candidate('Halo', ['Hip-Hop/Rap']), candidate('HALO', ['K-Pop'])]), undefined);
});

test('selects the first candidate with the same name when the service gives no genres', () => {
  const match = pickMatch('Netsky', [candidate('Netsky Fans'), candidate('Netsky', [], 'first'), candidate('NETSKY', [], 'second')]);
  assert.equal(match?.url, 'first');
});

test('selects no candidate when no name is the same', () => {
  assert.equal(pickMatch('Afrojack', [candidate('Afrojack & Mougleta', ['Dance'])]), undefined);
});

test('finds the names that 2 or more artists share', () => {
  assert.deepEqual(sharedNames(['Halo', 'HALŌ', 'Afrojack']), new Set(['Halo', 'HALŌ']));
});

test('reads iTunes results and removes the query from the link', () => {
  const candidates = itunesCandidates({
    results: [
      {
        artistName: 'AFROJACK',
        artistLinkUrl: 'https://music.apple.com/us/artist/afrojack/211210469?uo=4',
        primaryGenreName: 'Dance',
      },
      { artistName: 'No link' },
    ],
  });
  assert.deepEqual(candidates, [
    { name: 'AFROJACK', url: 'https://music.apple.com/us/artist/afrojack/211210469', genres: ['Dance'] },
  ]);
});

test('reads Spotify results', () => {
  const candidates = spotifyCandidates({
    artists: { items: [{ name: 'Afrojack', id: '4D75GcNG95ebPtNvoNVXhz', genres: ['big room'] }, { name: 'No id' }] },
  });
  assert.deepEqual(candidates, [
    { name: 'Afrojack', url: 'https://open.spotify.com/artist/4D75GcNG95ebPtNvoNVXhz', genres: ['big room'] },
  ]);
});

test('reads YouTube results as channel links', () => {
  const candidates = youtubeCandidates({
    items: [{ id: { channelId: 'UCabc' }, snippet: { channelTitle: 'Afrojack' } }, { id: {}, snippet: { title: 'x' } }],
  });
  assert.deepEqual(candidates, [{ name: 'Afrojack', url: 'https://www.youtube.com/channel/UCabc', genres: [] }]);
});
