import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLineup } from '../../src/data/load.ts';
import {
  convertLineup,
  daySetsYaml,
  mergeArtistYaml,
  mergeStagesYaml,
  type TomorrowlandPerformance,
  type TomorrowlandStage,
} from './convert.ts';

// The line-up page of Tomorrowland Thailand 2026 loads these files.
const CDN = 'https://artist-lineup-cdn.tomorrowland.com';
const EVENT = 'TL26TH';
const EVENT_UUID = '1ef6bc24-86ee-4324-a7d7-be56ef1f957a';

const DATA_DIR = fileURLToPath(new URL('../../data', import.meta.url));

async function fetchJson<T>(name: string): Promise<T> {
  const url = `${CDN}/${name}-${EVENT_UUID}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function write(file: string, contents: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents);
}

const { config } = await fetchJson<{ config: { weekends: { name: string }[] } }>(`config-${EVENT}`);
const { stages } = await fetchJson<{ stages: TomorrowlandStage[] }>(`stages-${EVENT}`);
const weekends = await Promise.all(
  config.weekends.map((weekend) => fetchJson<{ performances: TomorrowlandPerformance[] }>(`${EVENT}-${weekend.name}`)),
);
const lineup = convertLineup(
  stages,
  weekends.flatMap((weekend) => weekend.performances),
);

const stagesFile = path.join(DATA_DIR, 'stages.yml');
const stagesYaml = mergeStagesYaml(await readIfExists(stagesFile), lineup.stages);
if (stagesYaml !== undefined) await write(stagesFile, stagesYaml);

let changedArtists = 0;
for (const artist of lineup.artists) {
  const file = path.join(DATA_DIR, 'artists', `${artist.id}.yml`);
  const artistYaml = mergeArtistYaml(await readIfExists(file), artist);
  if (artistYaml !== undefined) {
    await write(file, artistYaml);
    changedArtists++;
  }
}

let setCount = 0;
for (const [date, sets] of lineup.days) {
  await write(path.join(DATA_DIR, 'sets', `${date}.yml`), daySetsYaml(sets));
  setCount += sets.length;
}

for (const warning of lineup.warnings) console.warn(`Warning: ${warning}`);
console.log(
  `Imported ${lineup.stages.length} stages, ${lineup.artists.length} artists (${changedArtists} files changed) ` +
    `and ${setCount} sets on ${lineup.days.size} days.`,
);

await loadLineup(DATA_DIR);
console.log('The data in data/ is valid.');
