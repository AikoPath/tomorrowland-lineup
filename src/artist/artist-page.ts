import type { Artist, Lineup, Stage } from '../data/schema.ts';

export interface ArtistSet {
  /** The festival day, `YYYY-MM-DD`. A set after midnight stays on the day before. */
  date: string;
  stage: Stage;
  start: string;
  end: string;
  /** The other artists of a B2B set. */
  otherArtists: Artist[];
}

export function artistSets(lineup: Lineup, artistId: string): ArtistSet[] {
  const stages = new Map(lineup.stages.map((stage) => [stage.id, stage]));
  const artists = new Map(lineup.artists.map((artist) => [artist.id, artist]));
  return lineup.days.flatMap(({ date, sets }) =>
    sets
      .filter((set) => set.artists.includes(artistId))
      .map((set) => ({
        date,
        stage: stages.get(set.stage)!,
        start: set.start,
        end: set.end,
        otherArtists: set.artists.filter((id) => id !== artistId).map((id) => artists.get(id)!),
      })),
  );
}

export interface Link {
  label: string;
  url: string;
}

const socialLabels = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  facebook: 'Facebook',
  website: 'Website',
} satisfies Record<keyof NonNullable<Artist['social']>, string>;

const musicLabels = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
} satisfies Record<keyof NonNullable<Artist['music']>, string>;

export function artistLinks(artist: Artist): { social: Link[]; music: Link[] } {
  return {
    social: toLinks(socialLabels, artist.social),
    music: toLinks(musicLabels, artist.music),
  };
}

function toLinks<K extends string>(labels: Record<K, string>, urls: Partial<Record<K, string>> = {}): Link[] {
  return (Object.keys(labels) as K[]).flatMap((key) => {
    const url = urls[key];
    return url ? [{ label: labels[key], url }] : [];
  });
}

export function formatDay(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** The data has local festival times in the form `YYYY-MM-DDTHH:MM`. */
export function formatTime(localTime: string): string {
  return localTime.slice(11, 16);
}
