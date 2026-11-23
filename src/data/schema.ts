import { z } from 'zod';

export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens');

const httpsUrl = z.url({ protocol: /^https$/, error: 'Expected an https URL' });

function linkTo(...domains: string[]) {
  const escaped = domains.map((domain) => domain.replaceAll('.', '\\.'));
  return z.url({
    protocol: /^https$/,
    hostname: new RegExp(`(^|\\.)(${escaped.join('|')})$`),
    error: `Expected an https link to ${domains.join(' or ')}`,
  });
}

// The YouTube player embeds one video by its ID, and the watch link has the ID in the "v" parameter.
const youtubeVideo = linkTo('youtube.com').refine((url) => {
  const { pathname, searchParams } = new URL(url);
  return pathname === '/watch' && /^[\w-]{11}$/.test(searchParams.get('v') ?? '');
}, 'Use the https://www.youtube.com/watch?v=… form');

export const artistSchema = z.strictObject({
  name: z.string().trim().min(1),
  image: httpsUrl.optional(),
  genres: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .refine((genre) => genre === genre.toLowerCase(), 'Use lowercase'),
    )
    .optional(),
  social: z
    .strictObject({
      instagram: linkTo('instagram.com').optional(),
      tiktok: linkTo('tiktok.com').optional(),
      x: linkTo('x.com', 'twitter.com').optional(),
      facebook: linkTo('facebook.com').optional(),
      website: httpsUrl.optional(),
    })
    .optional(),
  music: z
    .strictObject({
      spotify: linkTo('open.spotify.com').optional(),
      apple_music: linkTo('music.apple.com').optional(),
      youtube: youtubeVideo.optional(),
      soundcloud: linkTo('soundcloud.com').optional(),
    })
    .optional(),
});

export const stagesSchema = z.array(
  z.strictObject({
    id: idSchema,
    name: z.string().trim().min(1),
  }),
);

/** Local festival time to the minute, for example `2026-12-11T22:30`. */
const localTime = z.iso.datetime({
  local: true,
  precision: -1,
  error: 'Expected a local time in the form YYYY-MM-DDTHH:MM',
});

export const daySetsSchema = z.array(
  z.strictObject({
    artists: z.array(idSchema).min(1),
    stage: idSchema,
    start: localTime,
    end: localTime,
  }),
);

export type Artist = z.infer<typeof artistSchema> & { id: string };
export type Stage = z.infer<typeof stagesSchema>[number];
export type LineupSet = z.infer<typeof daySetsSchema>[number];
export interface Day {
  /** `YYYY-MM-DD`, from the file name. */
  date: string;
  sets: LineupSet[];
}
export interface Lineup {
  stages: Stage[];
  artists: Artist[];
  days: Day[];
}
