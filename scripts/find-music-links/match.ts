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

export type MusicKey = MusicService | 'soundcloud';

/** The Wikidata properties that hold the id of an artist on each music service. */
const WIKIDATA_PROPERTIES: Record<MusicKey, { property: string; url: (id: string) => string }> = {
  spotify: { property: 'P1902', url: (id) => `https://open.spotify.com/artist/${id}` },
  apple_music: { property: 'P2850', url: (id) => `https://music.apple.com/us/artist/${id}` },
  youtube: { property: 'P2397', url: (id) => `https://www.youtube.com/channel/${id}` },
  soundcloud: { property: 'P3040', url: (id) => `https://soundcloud.com/${id}` },
};
const MUSIC_KEYS = Object.keys(WIKIDATA_PROPERTIES) as MusicKey[];

export interface WikidataArtist {
  name: string;
  /** The id at the end of the Apple Music link in the artist file. */
  appleMusicId?: string;
}

export function appleMusicId(url: string | undefined): string | undefined {
  return url?.match(/\/(\d+)\/?$/)?.[1];
}

function labelVariants(name: string): string[] {
  const titleCase = name.toLowerCase().replace(/(^|\s)\S/g, (start) => start.toUpperCase());
  return [...new Set([name, titleCase])];
}

/**
 * Finds the Wikidata items of the artists by the Apple Music id, or by the name.
 * A name match must be a DJ (Q130857) or have a genre in electronic music (Q9778).
 */
export function wikidataQuery(artists: WikidataArtist[]): string {
  const appleIds = artists.flatMap((artist) => (artist.appleMusicId ? [JSON.stringify(artist.appleMusicId)] : []));
  const labels = artists.flatMap((artist) => labelVariants(artist.name).map((label) => `${JSON.stringify(label)}@en`));
  const optionals = MUSIC_KEYS.map((key) => `OPTIONAL { ?item wdt:${WIKIDATA_PROPERTIES[key].property} ?${key} }`);
  return `SELECT DISTINCT ?item ?label ?${MUSIC_KEYS.join(' ?')} WHERE {
  {
    VALUES ?appleId { ${appleIds.join(' ')} }
    ?item wdt:P2850 ?appleId .
  } UNION {
    VALUES ?label { ${labels.join(' ')} }
    ?item rdfs:label ?label .
    { ?item wdt:P106 wd:Q130857 } UNION { ?item wdt:P136/wdt:P279* wd:Q9778 }
  }
  ${optionals.join('\n  ')}
}`;
}

export type WikidataBinding = Record<string, { value: string } | undefined>;

/**
 * Gives the music links of each artist from the query results.
 * An artist with 2 or more items gets no links. A service with 2 or more ids gets no link.
 */
export function wikidataLinks(artists: WikidataArtist[], bindings: WikidataBinding[]): Map<string, Partial<Record<MusicKey, string>>> {
  const links = new Map<string, Partial<Record<MusicKey, string>>>();
  for (const artist of artists) {
    const rows = bindings.filter((row) =>
      row.label
        ? sameName(row.label.value, artist.name)
        : artist.appleMusicId !== undefined && row.apple_music?.value === artist.appleMusicId,
    );
    if (new Set(rows.map((row) => row.item?.value)).size !== 1) continue;
    const artistLinks: Partial<Record<MusicKey, string>> = {};
    for (const key of MUSIC_KEYS) {
      const ids = new Set(rows.flatMap((row) => (row[key] ? [row[key].value] : [])));
      if (ids.size === 1) artistLinks[key] = WIKIDATA_PROPERTIES[key].url([...ids][0]);
    }
    links.set(artist.name, artistLinks);
  }
  return links;
}
