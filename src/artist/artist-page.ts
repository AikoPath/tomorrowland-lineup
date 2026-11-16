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

export type SocialKey = keyof NonNullable<Artist['social']>;
export type MusicKey = keyof NonNullable<Artist['music']>;

export interface Link<K extends string = SocialKey | MusicKey> {
  key: K;
  label: string;
  url: string;
}

const socialLabels = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  facebook: 'Facebook',
  website: 'Website',
} satisfies Record<SocialKey, string>;

const musicLabels = {
  spotify: 'Spotify',
  apple_music: 'Apple Music',
  youtube: 'YouTube',
  soundcloud: 'SoundCloud',
} satisfies Record<MusicKey, string>;

export function artistLinks(artist: Artist): { social: Link<SocialKey>[]; music: Link<MusicKey>[] } {
  return {
    social: toLinks(socialLabels, artist.social),
    music: toLinks(musicLabels, artist.music),
  };
}

function toLinks<K extends string>(labels: Record<K, string>, urls: Partial<Record<K, string>> = {}): Link<K>[] {
  return (Object.keys(labels) as K[]).flatMap((key) => {
    const url = urls[key];
    return url ? [{ key, label: labels[key], url }] : [];
  });
}

/** For example `Fri 11 Dec`. */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** The data has local festival times in the form `YYYY-MM-DDTHH:MM`. */
export function formatTime(localTime: string): string {
  return localTime.slice(11, 16);
}
