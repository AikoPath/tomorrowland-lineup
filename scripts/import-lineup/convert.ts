import { Document, isMap, isSeq, parseDocument } from 'yaml';
import { artistSchema, type LineupSet, type Stage } from '../../src/data/schema.ts';

/** An artist in the Tomorrowland line-up JSON. Most link fields are absent. */
export interface TomorrowlandArtist {
  id: string;
  name: string;
  image?: string;
  instagram?: string;
  tiktok?: string;
  twitter?: string;
  facebook?: string;
  website?: string;
  spotify?: string;
  youtube?: string;
  soundcloud?: string;
}

export interface TomorrowlandStage {
  id: string;
  name: string;
}

export interface TomorrowlandPerformance {
  artists: TomorrowlandArtist[];
  stage: TomorrowlandStage;
  /**
   * Do not use this date for the festival day.
   * Tomorrowland gives a set that starts at 00:00 the date of the next day.
   */
  date: string;
  /** For example `2026-12-11 23:30:00+07:00`, in local festival time. */
  startTime: string;
  endTime: string;
}

type ArtistField = Exclude<keyof TomorrowlandArtist, 'id' | 'name'>;

const ARTIST_FIELD_PATHS: Record<ArtistField, readonly string[]> = {
  image: ['image'],
  instagram: ['social', 'instagram'],
  tiktok: ['social', 'tiktok'],
  twitter: ['social', 'x'],
  facebook: ['social', 'facebook'],
  website: ['social', 'website'],
  spotify: ['music', 'spotify'],
  youtube: ['music', 'youtube'],
  soundcloud: ['music', 'soundcloud'],
};

const PLACEHOLDER_ARTIST = 'more to be announced';

/**
 * Artist ids by the artist name in the Tomorrowland JSON, for names that give the same id. Each id stays the same
 * across imports, also when the JSON order changes.
 */
export const ARTIST_ID_OVERRIDES: Readonly<Record<string, string>> = {
  // A Thai DJ. "HALŌ", the supergroup of DubVision, Matisse & Sadko and Third Party, has the id "halo".
  Halo: 'halo-thailand',
};

export interface ImportedArtist {
  id: string;
  name: string;
  /** The YAML path and the value of each field that the JSON supplies. */
  fields: { path: readonly string[]; value: string }[];
}

export interface ImportedLineup {
  stages: Stage[];
  artists: ImportedArtist[];
  /** The sets of each festival day, by `YYYY-MM-DD`. */
  days: Map<string, LineupSet[]>;
  /** The values that the import skipped because they are not valid. */
  warnings: string[];
}

/** Makes an id from a name, for example `Kölsch` → `kolsch` and `Eli & Fur` → `eli-fur`. */
export function toId(name: string): string {
  const id = name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’!.:]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!id) throw new Error(`Cannot make an id from the name "${name}"`);
  return id;
}

export function convertLineup(
  tomorrowlandStages: TomorrowlandStage[],
  performances: TomorrowlandPerformance[],
  artistIdOverrides: Readonly<Record<string, string>> = ARTIST_ID_OVERRIDES,
): ImportedLineup {
  const warnings: string[] = [];
  const stageIds = new Map<string, string>();
  const stages: Stage[] = [];
  const addStage = (stage: TomorrowlandStage) => {
    if (stageIds.has(stage.id)) return stageIds.get(stage.id)!;
    const id = claimId(toId(stage.name), stage, stages.map((s) => s.id), 'stage');
    stageIds.set(stage.id, id);
    stages.push({ id, name: stage.name });
    return id;
  };
  tomorrowlandStages.forEach(addStage);

  const artistIds = new Map<string, string>();
  const artists: ImportedArtist[] = [];
  const addArtist = (artist: TomorrowlandArtist) => {
    if (artistIds.has(artist.id)) return artistIds.get(artist.id)!;
    const id = claimId(artistIdOverrides[artist.name.trim()] ?? toId(artist.name), artist, artists.map((a) => a.id), 'artist');
    artistIds.set(artist.id, id);
    artists.push({ id, name: artist.name.trim(), fields: artistFields(artist, warnings) });
    return id;
  };

  const days = new Map<string, LineupSet[]>();
  for (const performance of performances) {
    if (performance.artists.some((artist) => artist.name.trim().toLowerCase() === PLACEHOLDER_ARTIST)) continue;
    const set: LineupSet = {
      artists: performance.artists.map(addArtist),
      stage: addStage(performance.stage),
      start: toLocalTime(performance.startTime),
      end: toLocalTime(performance.endTime),
    };
    const day = festivalDay(set.start);
    days.set(day, [...(days.get(day) ?? []), set]);
  }
  for (const sets of days.values()) {
    sets.sort((a, b) => a.start.localeCompare(b.start) || a.stage.localeCompare(b.stage));
  }

  return { stages, artists, days, warnings };
}

/** Throws when two different Tomorrowland ids give the same id, because one file would then hold two artists. */
function claimId(id: string, source: { id: string; name: string }, usedIds: string[], kind: string): string {
  if (usedIds.includes(id)) {
    throw new Error(
      `Two ${kind}s have the id "${id}". "${source.name}" (Tomorrowland id ${source.id}) needs an entry in ` +
        (kind === 'artist' ? `ARTIST_ID_OVERRIDES, for example '${source.name}': '${id}-2'` : 'the import script'),
    );
  }
  return id;
}

function artistFields(artist: TomorrowlandArtist, warnings: string[]): ImportedArtist['fields'] {
  const fields: ImportedArtist['fields'] = [];
  for (const [field, path] of Object.entries(ARTIST_FIELD_PATHS) as [ArtistField, readonly string[]][]) {
    const raw = artist[field]?.trim();
    if (!raw) continue;
    const value = field === 'image' ? normalizeUrl(raw) : extractUrl(raw);
    const problem = value === undefined ? 'Expected a URL' : fieldProblem(path, value);
    if (problem) {
      warnings.push(`${artist.name}: skipped ${field} "${raw}": ${problem}`);
    } else {
      fields.push({ path, value: value! });
    }
  }
  return fields;
}

/** Percent-encodes characters such as spaces. Some image file names contain spaces. */
function normalizeUrl(raw: string): string | undefined {
  try {
    return new URL(raw).href;
  } catch {
    return undefined;
  }
}

/** Takes the URL out of a value such as `DJ MANDY - https://www.youtube.com/channel/UC…`. */
function extractUrl(raw: string): string | undefined {
  const match = raw.match(/https?:\/\/\S+/);
  return match ? normalizeUrl(match[0]) : undefined;
}

function fieldProblem(path: readonly string[], value: string): string | undefined {
  const artist: Record<string, unknown> = { name: 'Check' };
  if (path.length === 1) artist[path[0]] = value;
  else artist[path[0]] = { [path[1]]: value };
  const result = artistSchema.safeParse(artist);
  return result.success ? undefined : result.error.issues[0].message;
}

/** `2026-12-11 23:30:00+07:00` → `2026-12-11T23:30`. The JSON ends sets at `:01` seconds, so the seconds go. */
/** The festival closes before this hour. A set that starts earlier belongs to the night before. */
const FESTIVAL_DAY_START_HOUR = 6;

/** The `YYYY-MM-DD` of the festival day of a set that starts at `start` (`YYYY-MM-DDTHH:MM`). */
export function festivalDay(start: string): string {
  const date = start.slice(0, 10);
  if (Number(start.slice(11, 13)) >= FESTIVAL_DAY_START_HOUR) return date;
  const dayBefore = new Date(`${date}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  return dayBefore.toISOString().slice(0, 10);
}

function toLocalTime(time: string): string {
  const match = time.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (!match) throw new Error(`Unexpected time "${time}"`);
  return `${match[1]}T${match[2]}`;
}

const YAML_OPTIONS = { lineWidth: 0, flowCollectionPadding: false };

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Adds the name and the JSON fields that are empty in the artist file. The values in the file stay, because the
 * YAML files are the source of truth. Returns `undefined` when the file needs no change.
 */
export function mergeArtistYaml(existing: string | undefined, artist: ImportedArtist): string | undefined {
  const doc = existing === undefined ? new Document({}) : parseYaml(existing);
  let changed = existing === undefined;
  if (isEmpty(doc.get('name'))) {
    doc.set('name', artist.name);
    changed = true;
  }
  for (const { path, value } of artist.fields) {
    if (isEmpty(doc.getIn(path))) {
      doc.setIn(path, value);
      changed = true;
    }
  }
  return changed ? doc.toString(YAML_OPTIONS) : undefined;
}

/** Adds the stages that are not in `stages.yml`. The names in the file stay. Returns `undefined` when the file needs no change. */
export function mergeStagesYaml(existing: string | undefined, stages: Stage[]): string | undefined {
  const doc = existing === undefined ? new Document([]) : parseYaml(existing);
  if (!isSeq(doc.contents)) throw new Error('stages.yml must contain a list');
  const ids = new Set(doc.contents.items.map((item) => (isMap(item) ? item.get('id') : undefined)));
  const missing = stages.filter((stage) => !ids.has(stage.id));
  for (const stage of missing) doc.add(stage);
  return existing === undefined || missing.length > 0 ? doc.toString(YAML_OPTIONS) : undefined;
}

/** Writes all sets of one day. The import replaces the file each time. */
export function daySetsYaml(sets: LineupSet[]): string {
  const doc = new Document(sets);
  doc.commentBefore =
    ' npm run import:lineup writes this file from the Tomorrowland timetable.\n Changes here go away at the next import.';
  sets.forEach((_, index) => {
    const artists = doc.getIn([index, 'artists'], true);
    if (isSeq(artists)) artists.flow = true;
  });
  return doc.toString(YAML_OPTIONS);
}

function parseYaml(text: string): Document {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) throw doc.errors[0];
  return doc;
}
