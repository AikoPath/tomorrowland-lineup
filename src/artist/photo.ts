/**
 * The size of an artist photo on a page.
 * - `small`: the photo in a list, a timetable card or a Now card. The service worker saves all small photos.
 * - `large`: the photo at the top of the artist page.
 */
export type PhotoSize = 'small' | 'large';

/** These hosts use the Bunny CDN optimizer. It resizes a photo and also converts files such as TIFF that a browser cannot show. */
const RESIZING_HOSTS = new Set(['artist-lineup-cdn.tomorrowland.com', 'artist-lineup-assets.b-cdn.net']);
const RESIZED_WIDTH: Record<PhotoSize, number> = { small: 400, large: 800 };

/** The Spotify image CDN gives each size of a photo a different id prefix. */
const SPOTIFY_HOST = 'i.scdn.co';
const SPOTIFY_640_PREFIX = 'ab6761610000e5eb';
const SPOTIFY_PREFIX: Record<PhotoSize, string> = { small: 'ab67616100005174', large: SPOTIFY_640_PREFIX };

/** The URL of the artist photo at a size. A photo from a different host keeps its URL. */
export function photoUrl(image: string, size: PhotoSize): string {
  const url = new URL(image);
  if (RESIZING_HOSTS.has(url.hostname)) {
    url.searchParams.set('width', String(RESIZED_WIDTH[size]));
    return url.href;
  }
  if (url.hostname === SPOTIFY_HOST && url.pathname.startsWith(`/image/${SPOTIFY_640_PREFIX}`)) {
    url.pathname = url.pathname.replace(SPOTIFY_640_PREFIX, SPOTIFY_PREFIX[size]);
    return url.href;
  }
  return image;
}
