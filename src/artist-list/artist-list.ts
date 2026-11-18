import { formatTime } from '../artist/artist-page.ts';
import type { Artist, Lineup, Stage } from '../data/schema.ts';
import { favouriteKey } from '../favourites/favourites.ts';

/** The data that the filter needs for one artist. The page sends it to the browser as JSON. */
export interface FilterData {
  /** The words of the artist name, from `searchWords`. */
  words: string[];
  /** One item for each set of the artist. */
  sets: { date: string; stage: string }[];
  genres: string[];
}

export interface ListSet {
  /** From `favouriteKey`. */
  key: string;
  /** The festival day, `YYYY-MM-DD`. */
  date: string;
  stage: Stage;
  /** The local festival time, `YYYY-MM-DDTHH:MM`. */
  start: string;
}

export interface ArtistListEntry {
  artist: Artist;
  /** One item for each set, in timetable order. */
  sets: ListSet[];
  filter: FilterData;
}

/** An empty value accepts all artists. */
export interface ArtistFilter {
  query: string;
  date: string;
  stage: string;
  /** The artist must have one of these genres. */
  genres: string[];
}

export interface FilterOptions {
  dates: string[];
  /** Only the stages with sets, in the order of `stages.yml`. */
  stages: Stage[];
  /** The genres with the most artists first. Genres with the same number of artists are in alphabetical order. */
  genres: string[];
}

/** All artists in name order, also the artists with no sets. */
export function artistListEntries(lineup: Lineup): ArtistListEntry[] {
  const stages = new Map(lineup.stages.map((stage) => [stage.id, stage]));
  return lineup.artists.map((artist) => {
    const sets = lineup.days.flatMap(({ date, sets: daySets }) =>
      daySets
        .filter((set) => set.artists.includes(artist.id))
        .map((set) => ({
          key: favouriteKey(date, set.artists),
          date,
          stage: stages.get(set.stage)!,
          start: set.start,
        })),
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
    genres: genresByArtistCount(lineup.artists),
  };
}

function genresByArtistCount(artists: Artist[]): string[] {
  const counts = new Map<string, number>();
  for (const genre of artists.flatMap((artist) => artist.genres ?? [])) {
    counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
}

/** For example `Fri 21:00 · Crystal Garden`. */
export function setLabel(set: ListSet): string {
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${set.date}T00:00:00Z`),
  );
  return `${weekday} ${formatTime(set.start)} · ${set.stage.name}`;
}

/** The first letters of the first 2 words, for example `AF` for "Aly & Fila". */
export function initials(name: string): string {
  return name
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/** The data has genres in lowercase. The page shows them with a capital first letter, for example `Big room`. */
export function genreLabel(genre: string): string {
  return genre.charAt(0).toUpperCase() + genre.slice(1);
}

/** For example `Trance, Techno or House`. */
export function genresLabel(genres: string[]): string {
  return new Intl.ListFormat('en-GB', { type: 'disjunction' }).format(genres.map(genreLabel));
}

/** For example `3 artists · Trance`. */
export function listHeading(count: number, activeFilters: string[]): string {
  return [count === 1 ? '1 artist' : `${count} artists`, ...activeFilters].join(' · ');
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
  if (filter.genres.length > 0 && !filter.genres.some((genre) => data.genres.includes(genre))) return false;
  if (!filter.date && !filter.stage) return true;
  return data.sets.some(
    (set) => (!filter.date || set.date === filter.date) && (!filter.stage || set.stage === filter.stage),
  );
}
