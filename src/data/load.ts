import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  artistSchema,
  daySetsSchema,
  idSchema,
  stagesSchema,
  type Artist,
  type Day,
  type Lineup,
  type Stage,
} from './schema.ts';

export class LineupDataError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(
      `The lineup data is not valid (${problems.length} problems):\n` +
        problems.map((problem) => `  - ${problem}`).join('\n'),
    );
    this.name = 'LineupDataError';
    this.problems = problems;
  }
}

const daySchema = z.iso.date();

/**
 * Reads and validates `stages.yml`, `artists/*.yml` and `sets/*.yml` in `dataDir`.
 * Throws a `LineupDataError` that lists every problem in every file.
 */
export async function loadLineup(dataDir = 'data'): Promise<Lineup> {
  const problems: string[] = [];
  const report = (file: string, where: string, message: string) => {
    const location = where ? `${path.relative(process.cwd(), file)}: ${where}` : path.relative(process.cwd(), file);
    problems.push(`${location}: ${message}`);
  };

  async function readYaml<T>(file: string, schema: z.ZodType<T>): Promise<T | undefined> {
    let raw: unknown;
    try {
      raw = parse(await readFile(file, 'utf8'));
    } catch (error) {
      report(file, '', (error as Error).message.split('\n')[0]);
      return undefined;
    }
    const result = schema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) report(file, formatPath(issue.path), issue.message);
      return undefined;
    }
    return result.data;
  }

  async function readYamlDir<T>(
    dir: string,
    nameSchema: z.ZodType<string>,
    nameRule: string,
    schema: z.ZodType<T>,
  ): Promise<{ name: string; file: string; data: T | undefined }[]> {
    const entries: { name: string; file: string; data: T | undefined }[] = [];
    for (const fileName of await listFiles(dir)) {
      const file = path.join(dir, fileName);
      const name = fileName.replace(/\.yml$/, '');
      if (!fileName.endsWith('.yml')) {
        report(file, '', 'Use the .yml extension');
      } else if (!nameSchema.safeParse(name).success) {
        report(file, '', `The file name must be ${nameRule}`);
      } else {
        entries.push({ name, file, data: await readYaml(file, schema) });
      }
    }
    return entries;
  }

  const stagesFile = path.join(dataDir, 'stages.yml');
  const stages: Stage[] | undefined = (await fileExists(stagesFile)) ? await readYaml(stagesFile, stagesSchema) : [];
  const stageIds = new Set<string>();
  stages?.forEach((stage, index) => {
    if (stageIds.has(stage.id)) report(stagesFile, `[${index}].id`, `Duplicate stage id "${stage.id}"`);
    stageIds.add(stage.id);
  });

  const artistFiles = await readYamlDir(
    path.join(dataDir, 'artists'),
    idSchema,
    'the artist id: lowercase letters, digits and single hyphens',
    artistSchema,
  );
  // Use the file names as ids. Then an artist file with a problem does not also cause an "unknown artist" problem in each set.
  const artistIds = new Set(artistFiles.map(({ name }) => name));
  const artists: Artist[] = artistFiles.flatMap(({ name, data }) => (data ? [{ id: name, ...data }] : []));

  const dayFiles = await readYamlDir(path.join(dataDir, 'sets'), daySchema, 'a date: YYYY-MM-DD', daySetsSchema);
  const days: Day[] = dayFiles.flatMap(({ name: date, file, data: sets }) => {
    if (!sets) return [];
    const nextDate = addDays(date, 1);
    sets.forEach((set, index) => {
      if (stages && !stageIds.has(set.stage)) {
        report(file, `[${index}].stage`, `Unknown stage "${set.stage}". Add it to data/stages.yml or correct the id`);
      }
      set.artists.forEach((artistId, artistIndex) => {
        if (!artistIds.has(artistId)) {
          report(
            file,
            `[${index}].artists[${artistIndex}]`,
            `Unknown artist "${artistId}". Add data/artists/${artistId}.yml or correct the id`,
          );
        }
      });
      const startDate = set.start.slice(0, 10);
      if (startDate !== date && startDate !== nextDate) {
        report(file, `[${index}].start`, `Expected a start on ${date}, or on ${nextDate} after midnight`);
      }
      if (set.end <= set.start) report(file, `[${index}].end`, 'The end must be after the start');
    });
    return [
      {
        date,
        sets: sets.toSorted((a, b) => a.start.localeCompare(b.start) || a.stage.localeCompare(b.stage)),
      },
    ];
  });

  if (problems.length > 0) throw new LineupDataError(problems);

  return {
    stages: stages ?? [],
    artists: artists.toSorted((a, b) => a.name.localeCompare(b.name)),
    days: days.toSorted((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Formats a schema issue path as `[3].artists[0]` or `social.instagram`. */
function formatPath(segments: readonly PropertyKey[]): string {
  return segments
    .map((segment, index) => {
      if (typeof segment === 'number') return `[${segment}]`;
      return index === 0 ? String(segment) : `.${String(segment)}`;
    })
    .join('');
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && !entry.name.startsWith('.')).map((entry) => entry.name).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function fileExists(file: string): Promise<boolean> {
  return (await listFiles(path.dirname(file))).includes(path.basename(file));
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
