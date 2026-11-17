import type { Artist } from '../data/schema.ts';
import { artistLinks, type Link, type MusicKey } from './artist-page.ts';

export type Player =
  | { kind: 'embed'; src: string }
  /** Apple Music has no embed for an artist, so the player looks up the top song of the artist when the user clicks "Play". */
  | { kind: 'apple-top-song'; lookupUrl: string };

export interface MusicTab extends Link<MusicKey> {
  /** No player when the link has a form that the service cannot embed. */
  player?: Player;
}

export function musicTabs(artist: Artist): MusicTab[] {
  return artistLinks(artist).music.map((link) => {
    const player = playerFor(link.key, new URL(link.url));
    return player ? { ...link, player } : link;
  });
}

/** The player for the play button of the artist list: the player of the first music tab that has one. */
export function previewPlayer(artist: Artist): { service: MusicKey; player: Player } | undefined {
  const tab = musicTabs(artist).find((candidate) => candidate.player);
  return tab?.player && { service: tab.key, player: tab.player };
}

/** For example `spotify:artist:4D75GcNG95ebPtNvoNVXhz` for the embed of a Spotify artist. */
export function spotifyUri(player: Player): string | undefined {
  if (player.kind !== 'embed') return undefined;
  const id = player.src.match(/^https:\/\/open\.spotify\.com\/embed\/artist\/([A-Za-z0-9]+)$/)?.[1];
  return id && `spotify:artist:${id}`;
}

/** Gives no URL when Apple Music has no song for the artist or the lookup fails. */
export async function embedUrl(player: Player): Promise<string | undefined> {
  if (player.kind === 'embed') return player.src;
  return fetch(player.lookupUrl)
    .then((response) => (response.ok ? response.json() : {}))
    .then(appleSongEmbedUrl)
    .catch(() => undefined);
}

function playerFor(key: MusicKey, url: URL): Player | undefined {
  switch (key) {
    case 'spotify': {
      const id = url.pathname.match(/\/artist\/([A-Za-z0-9]+)/)?.[1];
      return id ? { kind: 'embed', src: `https://open.spotify.com/embed/artist/${id}` } : undefined;
    }
    case 'soundcloud': {
      const src = new URL('https://w.soundcloud.com/player/');
      src.searchParams.set('url', `${url.origin}${url.pathname}`);
      src.searchParams.set('auto_play', 'true');
      return { kind: 'embed', src: src.href };
    }
    case 'youtube': {
      // The playlist "UULF" + the channel ID without "UC" has the uploads of the channel with no Shorts.
      // The player cannot play most Shorts, so the full uploads playlist ("UU") often starts with an error.
      const channelId = url.pathname.match(/\/channel\/UC([\w-]+)/)?.[1];
      return channelId
        ? { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/videoseries?list=UULF${channelId}&autoplay=1` }
        : undefined;
    }
    case 'apple_music':
      return appleTopSongPlayer(url);
  }
}

function appleTopSongPlayer(url: URL): Player | undefined {
  const segments = url.pathname.split('/').filter(Boolean);
  const artistIndex = segments.indexOf('artist');
  const artistId = segments.at(-1);
  if (artistIndex === -1 || !artistId || !/^\d+$/.test(artistId)) return undefined;

  const lookup = new URL('https://itunes.apple.com/lookup');
  lookup.searchParams.set('id', artistId);
  lookup.searchParams.set('entity', 'song');
  lookup.searchParams.set('limit', '1');
  // A link without a storefront, such as music.apple.com/artist/…, opens the US storefront.
  const storefront = artistIndex === 1 ? segments[0] : 'us';
  lookup.searchParams.set('country', storefront);
  return { kind: 'apple-top-song', lookupUrl: lookup.href };
}

interface ItunesLookupResult {
  wrapperType?: string;
  trackViewUrl?: string;
}

/** The iTunes lookup gives the artist first, then the songs of the artist with the most popular song first. */
export function appleSongEmbedUrl(lookup: { results?: ItunesLookupResult[] }): string | undefined {
  const song = lookup.results?.find((result) => result.wrapperType === 'track' && result.trackViewUrl);
  if (!song?.trackViewUrl) return undefined;

  const url = new URL(song.trackViewUrl);
  url.hostname = 'embed.music.apple.com';
  url.searchParams.delete('uo');
  return url.href;
}
