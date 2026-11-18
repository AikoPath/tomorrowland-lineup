import { photoUrl } from '../artist/photo.ts';
import type { Artist, Lineup } from '../data/schema.ts';
import { favouriteKey } from '../favourites/favourites.ts';

export interface TimelineSet {
  /** From `favouriteKey`. */
  key: string;
  artists: Artist[];
  stageName: string;
  /** Local festival time in the form `YYYY-MM-DDTHH:MM`. */
  start: string;
  /** Local festival time in the form `YYYY-MM-DDTHH:MM`. */
  end: string;
  /** The image of the first artist with an image. */
  image?: string;
}

export interface TimelineDay {
  /** `YYYY-MM-DD` */
  date: string;
  /** The end of the last set of the day, in the form `YYYY-MM-DDTHH:MM`. */
  end: string;
  /** All sets of the day in start order. The page shows only the favourites. */
  sets: TimelineSet[];
}

/** The days with sets, in date order. Sets with the same start time are in the order of `stages.yml`. */
export function timelineDays(lineup: Lineup): TimelineDay[] {
  const artistsById = new Map(lineup.artists.map((artist) => [artist.id, artist]));
  const stageOrder = new Map(lineup.stages.map((stage, index) => [stage.id, index]));
  return lineup.days
    .filter(({ sets }) => sets.length > 0)
    .map(({ date, sets }) => {
      const timelineSets = [...sets]
        .sort((a, b) => a.start.localeCompare(b.start) || stageOrder.get(a.stage)! - stageOrder.get(b.stage)!)
        .map((set) => {
          const artists = set.artists.map((id) => {
            const artist = artistsById.get(id);
            if (!artist) throw new Error(`Unknown artist "${id}" in the sets of ${date}`);
            return artist;
          });
          const stage = lineup.stages.find((candidate) => candidate.id === set.stage);
          if (!stage) throw new Error(`Unknown stage "${set.stage}" in the sets of ${date}`);
          const image = artists.find((artist) => artist.image)?.image;
          return {
            key: favouriteKey(date, set.artists),
            artists,
            stageName: stage.name,
            start: set.start,
            end: set.end,
            ...(image && { image: photoUrl(image, 'small') }),
          };
        });
      const end = sets.map((set) => set.end).reduce((latest, candidate) => (candidate > latest ? candidate : latest));
      return { date, end, sets: timelineSets };
    });
}

/**
 * The minutes that the later set and the earlier set play at the same time. Zero when they do not overlap.
 * The times are in the form `YYYY-MM-DDTHH:MM`.
 */
export function overlapMinutes(
  earlier: { start: string; end: string },
  later: { start: string; end: string },
): number {
  const minutes = (localTime: string) => Date.parse(`${localTime}Z`) / 60_000;
  return Math.max(0, Math.min(minutes(earlier.end), minutes(later.end)) - minutes(later.start));
}

/** For example, `6 sets on Friday` or `1 set on Saturday`. */
export function setCountLabel(count: number, date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  return `${count} ${count === 1 ? 'set' : 'sets'} on ${weekday}`;
}

/**
 * The day that the page opens at. During the festival, this is the current festival day.
 * Before and after the festival, this is the first day with a favourite, or the first day.
 *
 * @param now The local festival time in the form `YYYY-MM-DDTHH:MM`.
 * @param favouriteDates The dates that have one or more favourite sets.
 */
export function initialDate(days: { date: string; end: string }[], now: string, favouriteDates: Set<string>): string {
  const festivalStarted = now >= days[0].date;
  const currentDay = days.find((day) => now < day.end);
  if (festivalStarted && currentDay) return currentDay.date;
  return (days.find((day) => favouriteDates.has(day.date)) ?? days[0]).date;
}
