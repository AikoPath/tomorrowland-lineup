import { toId } from '../import-lineup/convert.ts';

export type MusicService = 'spotify' | 'apple_music' | 'youtube';

/** An artist that a music service found for a search. */
export interface Candidate {
  name: string;
  url: string;
  /** The genres that the service gives. An empty list means that the service gives no genres. */
  genres: string[];
}

const ELECTRONIC_GENRE = /dance|electro|house|techno|trance|edm|drum|bass|dubstep|hardstyle|hardcore|big room|garage|breakbeat/i;

/** Two names are the same when they give the same id. "and" and "&" are the same. */
export function sameName(a: string, b: string): boolean {
  const key = (name: string) => {
    try {
      return toId(name.replace(/\band\b/gi, '&'));
    } catch {
      return undefined;
    }
  };
  const keyA = key(a);
  return keyA !== undefined && keyA === key(b);
}

/**
 * Selects the candidate that has the same name as the artist.
 * The festival is an electronic music festival, so a candidate with an electronic genre wins.
 * Returns `undefined` when no candidate has the name, or when 2 or more candidates have the name and none is electronic.
 */
export function pickMatch(name: string, candidates: Candidate[]): Candidate | undefined {
  const sameNames = candidates.filter((candidate) => sameName(candidate.name, name));
  const electronic = sameNames.find((candidate) => candidate.genres.some((genre) => ELECTRONIC_GENRE.test(genre)));
  if (electronic) return electronic;
  const genresKnown = sameNames.some((candidate) => candidate.genres.length > 0);
  if (genresKnown && sameNames.length > 1) return undefined;
  return sameNames[0];
}

/** The names that 2 or more artists of the lineup share. A search cannot tell these artists apart. */
export function sharedNames(names: string[]): Set<string> {
  const shared = new Set<string>();
  for (const name of names) {
    if (names.some((other) => other !== name && sameName(other, name))) shared.add(name);
  }
  return shared;
}

interface ItunesSearch {
  results?: { artistName?: string; artistLinkUrl?: string; primaryGenreName?: string }[];
}

export function itunesCandidates(response: ItunesSearch): Candidate[] {
  return (response.results ?? []).flatMap((result) => {
    if (!result.artistName || !result.artistLinkUrl) return [];
    const url = new URL(result.artistLinkUrl);
    url.search = '';
    return [{ name: result.artistName, url: url.href, genres: result.primaryGenreName ? [result.primaryGenreName] : [] }];
  });
}

interface SpotifySearch {
  artists?: { items?: { name?: string; id?: string; genres?: string[] }[] };
}

export function spotifyCandidates(response: SpotifySearch): Candidate[] {
  return (response.artists?.items ?? []).flatMap((item) =>
    item.name && item.id
      ? [{ name: item.name, url: `https://open.spotify.com/artist/${item.id}`, genres: item.genres ?? [] }]
      : [],
  );
}

interface YoutubeSearch {
  items?: { id?: { channelId?: string }; snippet?: { channelTitle?: string; title?: string } }[];
}

export function youtubeCandidates(response: YoutubeSearch): Candidate[] {
  return (response.items ?? []).flatMap((item) => {
    const channelId = item.id?.channelId;
    const name = item.snippet?.channelTitle ?? item.snippet?.title;
    return channelId && name ? [{ name, url: `https://www.youtube.com/channel/${channelId}`, genres: [] }] : [];
  });
}
