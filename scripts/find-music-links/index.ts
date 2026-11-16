import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { loadLineup } from '../../src/data/load.ts';
import { mergeArtistYaml } from '../import-lineup/convert.ts';
import {
  appleMusicId,
  itunesCandidates,
  pickMatch,
  sharedNames,
  spotifyCandidates,
  youtubeCandidates,
  wikidataLinks,
  wikidataQuery,
  type Candidate,
  type MusicKey,
  type MusicService,
  type WikidataArtist,
  type WikidataBinding,
} from './match.ts';

const DATA_DIR = fileURLToPath(new URL('../../data', import.meta.url));
const ARTISTS_DIR = path.join(DATA_DIR, 'artists');

interface Searcher {
  service: MusicService;
  search(name: string): Promise<Candidate[]>;
}

async function getJson<T>(url: URL | string, init?: RequestInit): Promise<T> {
  // The iTunes Search API allows about 20 requests each minute. A blocked request gets a 403 or a 429.
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, init);
    if (response.ok) return (await response.json()) as T;
    if ((response.status === 403 || response.status === 429) && attempt < 4) {
      console.warn(`${response.status} from ${new URL(url).hostname}. Wait 60 s.`);
      await sleep(60_000);
      continue;
    }
    throw new Error(`${init?.method ?? 'GET'} ${new URL(url).origin}: ${response.status} ${await response.text()}`);
  }
}

function itunes(): Searcher {
  return {
    service: 'apple_music',
    async search(name) {
      const url = new URL('https://itunes.apple.com/search');
      url.searchParams.set('term', name);
      url.searchParams.set('entity', 'musicArtist');
      url.searchParams.set('limit', '10');
      const result = itunesCandidates(await getJson(url));
      await sleep(3_000);
      return result;
    },
  };
}

async function spotify(clientId: string, clientSecret: string): Promise<Searcher> {
  const { access_token } = await getJson<{ access_token: string }>('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  return {
    service: 'spotify',
    async search(name) {
      const url = new URL('https://api.spotify.com/v1/search');
      url.searchParams.set('q', name);
      url.searchParams.set('type', 'artist');
      url.searchParams.set('limit', '10');
      return spotifyCandidates(await getJson(url, { headers: { Authorization: `Bearer ${access_token}` } }));
    },
  };
}

function youtube(apiKey: string): Searcher {
  return {
    service: 'youtube',
    async search(name) {
      // Each search uses 100 of the 10,000 units that a key gets each day.
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('type', 'channel');
      url.searchParams.set('q', name);
      url.searchParams.set('maxResults', '5');
      url.searchParams.set('key', apiKey);
      return youtubeCandidates(await getJson(url));
    },
  };
}

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, YOUTUBE_API_KEY } = process.env;
const searchers: Searcher[] = [itunes()];
if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) searchers.push(await spotify(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET));
else console.warn('Spotify skipped: set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.');
if (YOUTUBE_API_KEY) searchers.push(youtube(YOUTUBE_API_KEY));
else console.warn('YouTube skipped: set YOUTUBE_API_KEY.');

interface ArtistFile {
  id: string;
  file: string;
  text: string;
  name: string;
  music: Partial<Record<MusicKey, string>>;
}

const artists: ArtistFile[] = [];
for (const fileName of (await readdir(ARTISTS_DIR)).filter((name) => name.endsWith('.yml')).sort()) {
  const file = path.join(ARTISTS_DIR, fileName);
  const text = await readFile(file, 'utf8');
  const data = parse(text) as { name: string; music?: ArtistFile['music'] };
  artists.push({ id: fileName.slice(0, -'.yml'.length), file, text, name: data.name, music: data.music ?? {} });
}

async function findInWikidata(artists: WikidataArtist[]): Promise<Map<string, Partial<Record<MusicKey, string>>>> {
  const url = new URL('https://query.wikidata.org/sparql');
  url.searchParams.set('query', wikidataQuery(artists));
  const response = await getJson<{ results: { bindings: WikidataBinding[] } }>(url, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'tomorrowland-lineup-music-links/1.0' },
  });
  return wikidataLinks(artists, response.results.bindings);
}

const shared = sharedNames(artists.map((artist) => artist.name));
const wikidata = await findInWikidata(
  artists
    .filter((artist) => !shared.has(artist.name))
    .map((artist) => ({ name: artist.name, appleMusicId: appleMusicId(artist.music.apple_music) })),
);
const noMatch = new Map<MusicService, string[]>(searchers.map((searcher) => [searcher.service, []]));
let added = 0;

for (const artist of artists) {
  if (shared.has(artist.name)) continue;
  const fields: { path: string[]; value: string }[] = [];
  for (const [key, url] of Object.entries(wikidata.get(artist.name) ?? {}) as [MusicKey, string][]) {
    if (artist.music[key]) continue;
    artist.music[key] = url;
    fields.push({ path: ['music', key], value: url });
    console.log(`${artist.id}: ${key} ${url} (Wikidata)`);
  }
  for (const searcher of searchers) {
    if (artist.music[searcher.service]) continue;
    const match = pickMatch(artist.name, await searcher.search(artist.name));
    if (!match) {
      noMatch.get(searcher.service)!.push(artist.name);
      continue;
    }
    fields.push({ path: ['music', searcher.service], value: match.url });
    console.log(`${artist.id}: ${searcher.service} ${match.url} (${[match.name, ...match.genres].join(', ')})`);
  }
  const yaml = mergeArtistYaml(artist.text, { id: artist.id, name: artist.name, fields });
  if (yaml !== undefined) {
    await writeFile(artist.file, yaml);
    added += fields.length;
  }
}

console.log(`\nAdded ${added} links.`);
if (shared.size > 0) console.log(`Skipped because 2 or more artists have the name: ${[...shared].join(', ')}`);
for (const [service, names] of noMatch) {
  if (names.length > 0) console.log(`No match on ${service} (${names.length}): ${names.join(', ')}`);
}

await loadLineup(DATA_DIR);
console.log('The data in data/ is valid.');
