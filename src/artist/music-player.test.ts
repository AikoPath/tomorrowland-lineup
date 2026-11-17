import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appleSongEmbedUrl, musicTabs } from './music-player.ts';

test('musicTabs gives one tab with an embed player for each music link, in the order of the links, with an autoplay address when the service has one', () => {
  const tabs = musicTabs({
    id: 'afrojack',
    name: 'AFROJACK',
    music: {
      soundcloud: 'https://soundcloud.com/afrojack?utm_source=x',
      youtube: 'https://www.youtube.com/channel/UC5thKP1rA7SjbfBhQMOaWGg',
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
      url: 'https://www.youtube.com/channel/UC5thKP1rA7SjbfBhQMOaWGg',
      player: {
        kind: 'embed',
        src: 'https://www.youtube-nocookie.com/embed/videoseries?list=UULF5thKP1rA7SjbfBhQMOaWGg',
        autoplaySrc: 'https://www.youtube-nocookie.com/embed/videoseries?list=UULF5thKP1rA7SjbfBhQMOaWGg&autoplay=1',
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
