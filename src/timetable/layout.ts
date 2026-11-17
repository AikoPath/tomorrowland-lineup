import type { Artist, Day, Stage } from '../data/schema.ts';

export interface PlacedSet {
  artists: Artist[];
  /** Minutes from the start of the timetable to the start of the set. */
  offset: number;
  /** Length of the set in minutes. */
  length: number;
  /** `HH:MM` */
  start: string;
  /** `HH:MM` */
  end: string;
  /** The image of the first artist with an image. */
  image?: string;
  /** The first genre of the first artist with a genre. */
  genre?: string;
}

export interface StageColumn {
  stage: Stage;
  sets: PlacedSet[];
}

export interface HourMark {
  /** `HH:00` */
  label: string;
  /** Minutes from the start of the timetable. */
  offset: number;
}

export interface DayTimetable {
  /** Only the stages with sets on this day, in the order of `stages.yml`. */
  columns: StageColumn[];
  hours: HourMark[];
  /** Minutes from the first full hour before the first set to the first full hour after the last set. */
  length: number;
}

const MINUTES_PER_HOUR = 60;

/** Places each set of one day on a vertical time axis that starts and ends on a full hour. */
export function layoutDay(day: Day, stages: Stage[], artists: Artist[]): DayTimetable {
  if (day.sets.length === 0) return { columns: [], hours: [], length: 0 };

  const artistsById = new Map(artists.map((artist) => [artist.id, artist]));
  const firstStart = Math.min(...day.sets.map((set) => toMinutes(set.start)));
  const lastEnd = Math.max(...day.sets.map((set) => toMinutes(set.end)));
  const timetableStart = Math.floor(firstStart / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
  const timetableEnd = Math.ceil(lastEnd / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;

  const columns = stages
    .map((stage) => ({
      stage,
      sets: day.sets
        .filter((set) => set.stage === stage.id)
        .map((set) => {
          const setArtists = set.artists.map((id) => {
            const artist = artistsById.get(id);
            if (!artist) throw new Error(`Unknown artist "${id}" in the sets of ${day.date}`);
            return artist;
          });
          const placed: PlacedSet = {
            artists: setArtists,
            offset: toMinutes(set.start) - timetableStart,
            length: toMinutes(set.end) - toMinutes(set.start),
            start: clockTime(set.start),
            end: clockTime(set.end),
          };
          const image = setArtists.find((artist) => artist.image)?.image;
          const genre = setArtists.find((artist) => artist.genres?.length)?.genres?.[0];
          if (image) placed.image = image;
          if (genre) placed.genre = genre;
          return placed;
        }),
    }))
    .filter((column) => column.sets.length > 0);

  const hours: HourMark[] = [];
  for (let minute = timetableStart; minute < timetableEnd; minute += MINUTES_PER_HOUR) {
    const hour = (minute / MINUTES_PER_HOUR) % 24;
    hours.push({ label: `${String(hour).padStart(2, '0')}:00`, offset: minute - timetableStart });
  }

  return { columns, hours, length: timetableEnd - timetableStart };
}

/**
 * Minutes since 1970 for a local festival time. The time zone is UTC for the calculation only,
 * so that a daylight saving change in the time zone of the build machine has no effect.
 */
function toMinutes(localTime: string): number {
  return Date.parse(`${localTime}Z`) / 60_000;
}

function clockTime(localTime: string): string {
  return localTime.slice(11, 16);
}

/** For example, `Fri 11 Dec` for `2026-12-11`. */
export function dayLabel(date: string): string {
  const { weekday, dayAndMonth } = dayLabelParts(date);
  return `${weekday} ${dayAndMonth}`;
}

/** For example, `Fri` and `11 Dec` for `2026-12-11`. */
export function dayLabelParts(date: string): { weekday: string; dayAndMonth: string } {
  const utcDate = new Date(`${date}T00:00:00Z`);
  return {
    weekday: utcDate.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
    dayAndMonth: utcDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  };
}

/** For example, `11–13 Dec 2026` for `2026-12-11` to `2026-12-13`. */
export function dateRangeLabel(firstDate: string, lastDate: string): string {
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
  const fullDate = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  const last = format(lastDate, fullDate);
  if (firstDate === lastDate) return last;
  if (firstDate.slice(0, 7) === lastDate.slice(0, 7)) return `${format(firstDate, { day: 'numeric' })}–${last}`;
  return `${format(firstDate, fullDate)} – ${last}`;
}
