import type { Artist, Lineup, Stage } from '../data/schema.ts';

/** The data that the filter needs for one artist. The page sends it to the browser as JSON. */
export interface FilterData {
  /** The words of the artist name, from `searchWords`. */
  words: string[];
  /** One item for each set of the artist. */
  sets: { date: string; stage: string }[];
  genres: string[];
}

export interface ArtistListEntry {
  artist: Artist;
  /** One item for each set, in timetable order. */
  sets: { date: string; stage: Stage }[];
  filter: FilterData;
}

/** An empty value accepts all artists. */
export interface ArtistFilter {
  query: string;
  date: string;
  stage: string;
  genre: string;
}

export interface FilterOptions {
  dates: string[];
  /** Only the stages with sets, in the order of `stages.yml`. */
  stages: Stage[];
  genres: string[];
}

/** All artists in name order, also the artists with no sets. */
export function artistListEntries(lineup: Lineup): ArtistListEntry[] {
  const stages = new Map(lineup.stages.map((stage) => [stage.id, stage]));
  return lineup.artists.map((artist) => {
    const sets = lineup.days.flatMap(({ date, sets: daySets }) =>
      daySets.filter((set) => set.artists.includes(artist.id)).map((set) => ({ date, stage: stages.get(set.stage)! })),
    );
    return {
      artist,
      sets,
      filter: {
        words: searchWords(artist.name),
        sets: sets.map(({ date, stage }) => ({ date, stage: stage.id })),
        genres: artist.genres ?? [],
      },
    };
  });
}

export function filterOptions(lineup: Lineup): FilterOptions {
  const stageIds = new Set(lineup.days.flatMap(({ sets }) => sets.map((set) => set.stage)));
  return {
    dates: lineup.days.filter(({ sets }) => sets.length > 0).map(({ date }) => date),
    stages: lineup.stages.filter((stage) => stageIds.has(stage.id)),
    genres: [...new Set(lineup.artists.flatMap((artist) => artist.genres ?? []))].sort(),
  };
}

/**
 * Lowercase words with no accents, so that "halo" finds "HALŌ" and "dimitri like" finds
 * "Dimitri Vegas & Like Mike".
 */
export function searchWords(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Each word of the query must be a part of a word of the name.
 * The day and the stage must match the same set.
 */
export function matchesFilter(data: FilterData, filter: ArtistFilter): boolean {
  const queryWords = searchWords(filter.query);
  if (!queryWords.every((queryWord) => data.words.some((word) => word.includes(queryWord)))) return false;
  if (filter.genre && !data.genres.includes(filter.genre)) return false;
  if (!filter.date && !filter.stage) return true;
  return data.sets.some(
    (set) => (!filter.date || set.date === filter.date) && (!filter.stage || set.stage === filter.stage),
  );
}
