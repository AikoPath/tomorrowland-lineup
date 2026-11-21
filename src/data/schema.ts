import { z } from 'zod';
import { PHOTO_PROXIES } from '../artist/photo.ts';

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

// The site shows a photo only through a photo proxy. Thus the schema accepts a photo only from the host of a proxy.
const photoOrigins: string[] = PHOTO_PROXIES.map(({ origin }) => origin);
const photoHosts = photoOrigins.map((origin) => new URL(origin).host);
const photoLink = z
  .url({ protocol: /^https$/, error: 'Expected an https URL', abort: true })
  .refine((url) => photoOrigins.includes(new URL(url).origin), {
    error: `Expected an https link to ${photoHosts.slice(0, -1).join(', ')} or ${photoHosts.at(-1)}`,
  });

// The YouTube player embeds a channel by its ID, and only /channel/ links contain the ID.
const youtubeChannel = linkTo('youtube.com').refine(
  (url) => /^\/channel\/UC[\w-]+\/?$/.test(new URL(url).pathname),
  'Use the https://www.youtube.com/channel/UC… form',
);

export const artistSchema = z.strictObject({
  name: z.string().trim().min(1),
  image: photoLink.optional(),
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
      youtube: youtubeChannel.optional(),
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
