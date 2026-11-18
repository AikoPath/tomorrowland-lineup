import { photoUrl } from '../artist/photo.ts';
import type { Artist, Lineup } from '../data/schema.ts';
import { dayLabel } from '../timetable/layout.ts';
import { artistUrl } from '../urls.ts';

/** The "−" and "+" buttons move the time by this number of minutes. */
export const TIME_STEP = 30;

const MINUTES_PER_DAY = 24 * 60;

export interface NowArtist {
  name: string;
  url: string;
  image?: string;
  initials: string;
}

export interface NowSet {
  artists: NowArtist[];
  /** Minutes from 00:00 on the date of the festival day. A set after midnight has a value of 1440 or more. */
  start: number;
  end: number;
}

export interface NowStage {
  name: string;
  /** In start order. */
  sets: NowSet[];
}

/** The data of one festival day. The page sends it to the browser as JSON. */
export interface NowDay {
  /** `YYYY-MM-DD` */
  date: string;
  /** For example, `Fri 11 Dec`. */
  label: string;
  /** The start of the first set, in minutes from 00:00 on `date`. */
  start: number;
  /** The end of the last set, in minutes from 00:00 on `date`. */
  end: number;
  /** Only the stages with sets on this day, in the order of `stages.yml`. */
  stages: NowStage[];
}

export interface StageState {
  current?: {
    set: NowSet;
    /** From 0 at the start of the set to 1 at the end. */
    progress: number;
    minutesLeft: number;
  };
  next?: NowSet;
}

/** The days with sets, in date order. */
export function nowDays(lineup: Lineup): NowDay[] {
  const artistsById = new Map(lineup.artists.map((artist) => [artist.id, artist]));
  return lineup.days
    .filter(({ sets }) => sets.length > 0)
    .map(({ date, sets }) => {
      const stages = lineup.stages
        .map((stage) => ({
          name: stage.name,
          sets: sets
            .filter((set) => set.stage === stage.id)
            .map((set) => ({
              artists: set.artists.map((id) => {
                const artist = artistsById.get(id);
                if (!artist) throw new Error(`Unknown artist "${id}" in the sets of ${date}`);
                return nowArtist(artist);
              }),
              start: minutesFrom(date, set.start),
              end: minutesFrom(date, set.end),
            })),
        }))
        .filter((stage) => stage.sets.length > 0);
      const allSets = stages.flatMap((stage) => stage.sets);
      return {
        date,
        label: dayLabel(date),
        start: Math.min(...allSets.map((set) => set.start)),
        end: Math.max(...allSets.map((set) => set.end)),
        stages,
      };
    });
}

function nowArtist(artist: Artist): NowArtist {
  return {
    name: artist.name,
    url: artistUrl(artist.id),
    ...(artist.image && { image: photoUrl(artist.image, 'small') }),
    initials: initials(artist.name),
  };
}

/** The first letters of the first two words, for example `AF` for `Aly & Fila`. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** The set that plays at `minute` and the next set that starts after `minute`. */
export function stageState(stage: NowStage, minute: number): StageState {
  const current = stage.sets.findLast((set) => set.start <= minute && minute < set.end);
  const next = stage.sets.find((set) => set.start > minute);
  return {
    ...(current && {
      current: {
        set: current,
        progress: (minute - current.start) / (current.end - current.start),
        minutesLeft: current.end - minute,
      },
    }),
    ...(next && { next }),
  };
}

/**
 * The day and the time that the page opens at. During a festival day, this is the current time.
 * Before a festival day, this is the start of the day. After the festival, this is the start of the first day.
 *
 * @param now The local festival time in the form `YYYY-MM-DDTHH:MM`.
 */
export function festivalPosition(days: NowDay[], now: string): { dayIndex: number; minute: number } {
  const dayIndex = days.findIndex((day) => minutesFrom(day.date, now) < day.end);
  if (dayIndex === -1) return { dayIndex: 0, minute: days[0].start };
  const day = days[dayIndex];
  return { dayIndex, minute: Math.max(minutesFrom(day.date, now), day.start) };
}

/** Keeps `minute` between the start of the first set and the end of the last set of `day`. */
export function clampTime(day: NowDay, minute: number): number {
  return Math.min(Math.max(minute, day.start), day.end);
}

/** The local time in `timeZone` in the form `YYYY-MM-DDTHH:MM`. */
export function festivalNow(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

/** For example, `00:30` for 1470 minutes. */
export function clockLabel(minute: number): string {
  const inDay = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(inDay / 60);
  return `${String(hours).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`;
}

/** For example, `1 h 10 min left`, `1 h left` or `45 min left`. */
export function timeLeftLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours > 0 && `${hours} h`, rest > 0 && `${rest} min`, 'left'].filter(Boolean).join(' ');
}

/**
 * Minutes from 00:00 on `date` to `localTime`. The time zone is UTC for the calculation only,
 * so that a daylight saving change in the time zone of the machine has no effect.
 */
function minutesFrom(date: string, localTime: string): number {
  return (Date.parse(`${localTime}Z`) - Date.parse(`${date}T00:00Z`)) / 60_000;
}
