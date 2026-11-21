import { REPO_URL } from './site.ts';

export function artistUrl(artistId: string): string {
  return `/artists/${artistId}/`;
}

/** Each festival day has its own page. The home page also shows the first day, but sends the user to the page of today. */
export function dayUrl(date: string): string {
  return `/${date}/`;
}

export const LINEUP_URL = '/';

export const NOW_URL = '/now/';

/** The favourite sets of the user. */
export const TIMELINE_URL = '/timeline/';

export const SIGN_IN_URL = '/sign-in/';

/** The link in the sign-in email opens this page. */
export const SIGN_IN_CONFIRM_URL = '/sign-in/confirm/';

/** The Explore page lists all artists. */
export const EXPLORE_URL = '/artists/';

/** The build writes the service worker to this URL. See src/pwa/service-worker.ts. */
export const SERVICE_WORKER_URL = '/sw.js';

/** The page sends this message to the service worker after it loads. Then the service worker saves the artist photos. */
export const SAVE_PHOTOS_MESSAGE = 'save-photos';

/** GitHub opens the file in its editor and makes a fork for a user with no write access. */
export function editArtistDataUrl(artistId: string): string {
  return `${REPO_URL}/edit/main/data/artists/${artistId}.yml`;
}
