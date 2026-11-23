import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PreviewPlayer } from '../artist/music-player.ts';
import {
  dedupeTracks,
  rememberPreviousUrl,
  resolveTrackPlayer,
  stepTrack,
  type PlayerTrack,
} from './player-state.ts';

const spotifyPlayer: PreviewPlayer = {
  service: 'spotify',
  player: { kind: 'embed', src: 'https://open.spotify.com/embed/artist/4D75GcNG95ebPtNvoNVXhz' },
};

const youtubePlayer: PreviewPlayer = {
  service: 'youtube',
  player: {
    kind: 'embed',
    src: 'https://www.youtube-nocookie.com/embed/abc',
    autoplaySrc: 'https://www.youtube-nocookie.com/embed/abc?autoplay=1',
  },
};

const soundcloudPlayer: PreviewPlayer = {
  service: 'soundcloud',
  player: {
    kind: 'embed',
    src: 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fexample',
    autoplaySrc: 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fexample&auto_play=true',
  },
};

const track: PlayerTrack = {
  artistId: 'afrojack',
  artistName: 'AFROJACK',
  artistUrl: '/artists/afrojack/',
  players: [spotifyPlayer, youtubePlayer],
};

test('resolveTrackPlayer uses the requested service when the artist has it', () => {
  assert.deepEqual(resolveTrackPlayer(track, 'spotify', 'youtube'), {
    service: 'youtube',
    player: youtubePlayer.player,
  });
});

test('resolveTrackPlayer falls back to the preferred service when the requested service is absent', () => {
  assert.deepEqual(resolveTrackPlayer(track, 'youtube', 'soundcloud'), {
    service: 'youtube',
    player: youtubePlayer.player,
    fallbackFrom: undefined,
  });
});

test('resolveTrackPlayer marks fallbackFrom when the artist lacks the preferred service', () => {
  assert.deepEqual(resolveTrackPlayer(track, 'soundcloud'), {
    service: 'spotify',
    player: spotifyPlayer.player,
    fallbackFrom: 'soundcloud',
  });
});

test('resolveTrackPlayer returns undefined when the artist has no embeddable players', () => {
  assert.equal(resolveTrackPlayer({ ...track, players: [] }, 'spotify'), undefined);
});

test('rememberPreviousUrl keeps same-origin URLs outside the sign-in flow', () => {
  assert.equal(
    rememberPreviousUrl('https://example.com/timeline/?day=1', 'https://example.com', '/sign-in/'),
    'https://example.com/timeline/?day=1',
  );
  assert.equal(
    rememberPreviousUrl('https://example.com/sign-in/', 'https://example.com', '/sign-in/'),
    undefined,
  );
  assert.equal(
    rememberPreviousUrl('https://example.com/sign-in/confirm/', 'https://example.com', '/sign-in/'),
    undefined,
  );
  assert.equal(
    rememberPreviousUrl('https://other.example/artists/', 'https://example.com', '/sign-in/'),
    undefined,
  );
  assert.equal(rememberPreviousUrl('', 'https://example.com', '/sign-in/'), undefined);
});

test('dedupeTracks keeps the first occurrence of each artist in order', () => {
  const a: PlayerTrack = { artistId: 'a', artistName: 'A', artistUrl: '/artists/a/', players: [spotifyPlayer] };
  const b: PlayerTrack = { artistId: 'b', artistName: 'B', artistUrl: '/artists/b/', players: [youtubePlayer] };
  assert.deepEqual(
    dedupeTracks([a, b, a]).map((item) => item.artistId),
    ['a', 'b'],
  );
});

test('stepTrack moves forward and backward through the queue with wrap-around', () => {
  const a: PlayerTrack = { artistId: 'a', artistName: 'A', artistUrl: '/artists/a/', players: [spotifyPlayer] };
  const b: PlayerTrack = { artistId: 'b', artistName: 'B', artistUrl: '/artists/b/', players: [youtubePlayer] };
  const c: PlayerTrack = { artistId: 'c', artistName: 'C', artistUrl: '/artists/c/', players: [soundcloudPlayer] };

  assert.equal(stepTrack([a, b, c], 'a', 1)?.artistId, 'b');
  assert.equal(stepTrack([a, b, c], 'c', 1)?.artistId, 'a');
  assert.equal(stepTrack([a, b, c], 'a', -1)?.artistId, 'c');
  assert.equal(stepTrack([a, b, c], 'unknown', 1)?.artistId, 'a');
  assert.equal(stepTrack([a, b, c], 'unknown', -1)?.artistId, 'c');
  assert.equal(stepTrack([a], 'a', 1), undefined);
  assert.equal(stepTrack([], 'a', 1), undefined);
});
