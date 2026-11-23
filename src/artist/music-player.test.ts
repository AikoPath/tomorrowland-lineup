import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appleSongEmbedUrl,
  choosePreview,
  MUSIC_SERVICE_STORAGE_KEY,
  musicTabs,
  playableSetArtist,
  previewPlayers,
  readMusicService,
  saveMusicService,
  soundcloudUrl,
  spotifyUri,
  youtubeVideoId,
  type MusicServiceStorage,
  type PreviewPlayer,
} from './music-player.ts';

test('musicTabs gives one tab with an embed player for each music link, in the order of the links, with an autoplay address when the service has one', () => {
  const tabs = musicTabs({
    id: 'afrojack',
    name: 'AFROJACK',
    music: {
      soundcloud: 'https://soundcloud.com/afrojack?utm_source=x',
      youtube: 'https://www.youtube.com/watch?v=09k23KLQqgo',
      spotify: 'https://open.spotify.com/artist/4D75GcNG95ebPtNvoNVXhz?si=abc',
    },
  });

  assert.deepEqual(tabs, [
    {
      key: 'spotify',
      label: 'Spotify',
      url: 'https://open.spotify.com/artist/4D75GcNG95ebPtNvoNVXhz?si=abc',
      player: { kind: 'embed', src: 'https://open.spotify.com/embed/artist/4D75GcNG95ebPtNvoNVXhz' },
    },
    {
      key: 'youtube',
      label: 'YouTube',
      url: 'https://www.youtube.com/watch?v=09k23KLQqgo',
      player: {
        kind: 'embed',
        src: 'https://www.youtube-nocookie.com/embed/09k23KLQqgo',
        autoplaySrc: 'https://www.youtube-nocookie.com/embed/09k23KLQqgo?autoplay=1',
      },
    },
    {
      key: 'soundcloud',
      label: 'SoundCloud',
      url: 'https://soundcloud.com/afrojack?utm_source=x',
      player: {
        kind: 'embed',
        src: 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fafrojack',
        autoplaySrc: 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fafrojack&auto_play=true',
      },
    },
  ]);
});

test('musicTabs gives an Apple Music tab that looks up the top song in the storefront of the link', () => {
  const [tab] = musicTabs({
    id: 'afrojack',
    name: 'AFROJACK',
    music: { apple_music: 'https://music.apple.com/nl/artist/afrojack/211210469?uo=4' },
  });

  assert.deepEqual(tab?.player, {
    kind: 'apple-top-song',
    lookupUrl: 'https://itunes.apple.com/lookup?id=211210469&entity=song&limit=1&country=nl',
  });
});

test('musicTabs uses the US storefront for an Apple Music link with no storefront', () => {
  const [tab] = musicTabs({
    id: 'afrojack',
    name: 'AFROJACK',
    music: { apple_music: 'https://music.apple.com/artist/211210469' },
  });

  assert.deepEqual(tab?.player, {
    kind: 'apple-top-song',
    lookupUrl: 'https://itunes.apple.com/lookup?id=211210469&entity=song&limit=1&country=us',
  });
});

test('musicTabs gives a tab with no player for a link that is not to an artist', () => {
  const tabs = musicTabs({
    id: 'afrojack',
    name: 'AFROJACK',
    music: {
      spotify: 'https://open.spotify.com/track/abc',
      apple_music: 'https://music.apple.com/us/album/listen/924562828',
    },
  });

  assert.deepEqual(tabs, [
    { key: 'spotify', label: 'Spotify', url: 'https://open.spotify.com/track/abc' },
    { key: 'apple_music', label: 'Apple Music', url: 'https://music.apple.com/us/album/listen/924562828' },
  ]);
});

test('musicTabs gives no tabs when the artist has no music links', () => {
  assert.deepEqual(musicTabs({ id: 'kolsch', name: 'Kölsch' }), []);
});

test('appleSongEmbedUrl gives the embed URL of the first song in the iTunes lookup', () => {
  const url = appleSongEmbedUrl({
    results: [
      { wrapperType: 'artist' },
      {
        wrapperType: 'track',
        trackViewUrl: 'https://music.apple.com/us/album/hey-mama/924562828?i=924568962&uo=4',
      },
    ],
  });

  assert.equal(url, 'https://embed.music.apple.com/us/album/hey-mama/924562828?i=924568962');
});

test('appleSongEmbedUrl gives no URL when the lookup has no song', () => {
  assert.equal(appleSongEmbedUrl({ results: [{ wrapperType: 'artist' }] }), undefined);
  assert.equal(appleSongEmbedUrl({}), undefined);
});

const youtubePreview: PreviewPlayer = {
  service: 'youtube',
  player: {
    kind: 'embed',
    src: 'https://www.youtube-nocookie.com/embed/abc',
    autoplaySrc: 'https://www.youtube-nocookie.com/embed/abc?autoplay=1',
  },
};

const spotifyPreview: PreviewPlayer = {
  service: 'spotify',
  player: { kind: 'embed', src: 'https://open.spotify.com/embed/artist/4D75GcNG95ebPtNvoNVXhz' },
};

test('previewPlayers gives the player of each music link that has one, in the order of the tabs', () => {
  assert.deepEqual(
    previewPlayers({
      id: 'example',
      name: 'Example',
      music: {
        soundcloud: 'https://soundcloud.com/example',
        spotify: 'https://open.spotify.com/user/example',
        youtube: 'https://www.youtube.com/watch?v=abc',
      },
    }).map((preview) => preview.service),
    ['youtube', 'soundcloud'],
  );
  assert.deepEqual(previewPlayers({ id: 'example', name: 'Example' }), []);
});

test('choosePreview gives the player of the chosen service', () => {
  assert.equal(choosePreview([spotifyPreview, youtubePreview], 'youtube'), youtubePreview);
});

test('choosePreview gives the first player when the artist has no player for the chosen service', () => {
  assert.equal(choosePreview([spotifyPreview, youtubePreview], 'soundcloud'), spotifyPreview);
  assert.equal(choosePreview([spotifyPreview, youtubePreview], undefined), spotifyPreview);
  assert.equal(choosePreview([], 'spotify'), undefined);
});

function memoryStorage(values: Record<string, string> = {}): MusicServiceStorage {
  return {
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
  };
}

test('readMusicService gives the service that saveMusicService saved', () => {
  const storage = memoryStorage();
  assert.equal(readMusicService(storage), undefined);
  saveMusicService(storage, 'apple_music');
  assert.equal(readMusicService(storage), 'apple_music');
});

test('readMusicService gives no service for an unknown value', () => {
  assert.equal(readMusicService(memoryStorage({ [MUSIC_SERVICE_STORAGE_KEY]: 'tidal' })), undefined);
  assert.equal(readMusicService(memoryStorage({ [MUSIC_SERVICE_STORAGE_KEY]: 'toString' })), undefined);
});

test('spotifyUri gives the URI of the artist of a Spotify embed', () => {
  assert.equal(
    spotifyUri({ kind: 'embed', src: 'https://open.spotify.com/embed/artist/4D75GcNG95ebPtNvoNVXhz' }),
    'spotify:artist:4D75GcNG95ebPtNvoNVXhz',
  );
  assert.equal(spotifyUri({ kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/abc' }), undefined);
  assert.equal(spotifyUri({ kind: 'apple-top-song', lookupUrl: 'https://itunes.apple.com/lookup?id=1' }), undefined);
});

test('playableSetArtist returns the first artist in a set that has an embeddable player', () => {
  const withoutMusic = { id: 'first', name: 'First' };
  const withMusic = {
    id: 'second',
    name: 'Second',
    music: { spotify: 'https://open.spotify.com/artist/4D75GcNG95ebPtNvoNVXhz' },
  };
  const found = playableSetArtist([withoutMusic, withMusic]);
  assert.equal(found?.artist.id, 'second');
  assert.deepEqual(
    found?.players.map((item) => item.service),
    ['spotify'],
  );
  assert.equal(playableSetArtist([withoutMusic]), undefined);
});

test('soundcloudUrl extracts the artist URL from a SoundCloud embed player', () => {
  assert.equal(
    soundcloudUrl({
      kind: 'embed',
      src: 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fafrojack',
    }),
    'https://soundcloud.com/afrojack',
  );
  assert.equal(soundcloudUrl(spotifyPreview.player), undefined);
});

test('youtubeVideoId extracts the video ID from a YouTube embed player', () => {
  assert.equal(youtubeVideoId(youtubePreview.player), 'abc');
  assert.equal(youtubeVideoId(spotifyPreview.player), undefined);
});
