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
        .map((set) => ({
          artists: set.artists.map((id) => {
            const artist = artistsById.get(id);
            if (!artist) throw new Error(`Unknown artist "${id}" in the sets of ${day.date}`);
            return artist;
          }),
          offset: toMinutes(set.start) - timetableStart,
          length: toMinutes(set.end) - toMinutes(set.start),
          start: clockTime(set.start),
          end: clockTime(set.end),
        })),
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
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
