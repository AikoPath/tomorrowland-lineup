/**
 * The size of an artist photo on a page.
 * - `small`: the photo in a list, a timetable card or a Now card. The service worker saves all small photos.
 * - `large`: the photo at the top of the artist page.
 */
export type PhotoSize = 'small' | 'large';

/**
 * The site gets the artist photos from these hosts through its own domain. vercel.json has a rewrite for each path,
 * and astro.config.mjs has a proxy for each path in the dev server. With the photos on the same domain, the service
 * worker can read each photo: it sees errors, and the browser counts the real size of the saved photos.
 */
export const PHOTO_PROXIES = [
  { path: '/photos/tml', origin: 'https://artist-lineup-cdn.tomorrowland.com' },
  { path: '/photos/bunny', origin: 'https://artist-lineup-assets.b-cdn.net' },
  { path: '/photos/spotify', origin: 'https://i.scdn.co' },
  { path: '/photos/soundcloud', origin: 'https://i1.sndcdn.com' },
  { path: '/photos/ra', origin: 'https://static.ra.co' },
  { path: '/photos/edm-addicts', origin: 'https://app.edm-addicts.com' },
  { path: '/photos/youtube', origin: 'https://yt3.googleusercontent.com' },
  { path: '/photos/beatport', origin: 'https://geo-media.beatport.com' },
  { path: '/photos/ade', origin: 'https://cdn.amsterdam-dance-event.nl' },
] as const;

/** These hosts use the Bunny CDN optimizer. It resizes a photo and also converts files such as TIFF that a browser cannot show. */
const RESIZING_ORIGINS = new Set<string>(['https://artist-lineup-cdn.tomorrowland.com', 'https://artist-lineup-assets.b-cdn.net']);
const RESIZED_WIDTH: Record<PhotoSize, number> = { small: 400, large: 800 };

/** The Spotify image CDN gives each size of a photo a different id prefix. */
const SPOTIFY_ORIGIN = 'https://i.scdn.co';
const SPOTIFY_640_PREFIX = 'ab6761610000e5eb';
const SPOTIFY_PREFIX: Record<PhotoSize, string> = { small: 'ab67616100005174', large: SPOTIFY_640_PREFIX };

/** The URL of the artist photo at a size, on the domain of the site. A photo from a different host keeps its URL. */
export function photoUrl(image: string, size: PhotoSize): string {
  const url = new URL(image);
  const proxy = PHOTO_PROXIES.find((candidate) => candidate.origin === url.origin);
  if (!proxy) return image;

  if (RESIZING_ORIGINS.has(url.origin)) url.searchParams.set('width', String(RESIZED_WIDTH[size]));
  if (url.origin === SPOTIFY_ORIGIN && url.pathname.startsWith(`/image/${SPOTIFY_640_PREFIX}`)) {
    url.pathname = url.pathname.replace(SPOTIFY_640_PREFIX, SPOTIFY_PREFIX[size]);
  }
  return `${proxy.path}${url.pathname}${url.search}`;
}
