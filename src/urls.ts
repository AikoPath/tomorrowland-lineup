import { REPO_URL } from './site.ts';

export function artistUrl(artistId: string): string {
  return `/artists/${artistId}/`;
}

/** The home page shows the first festival day. Each other day has its own page. */
export function dayUrl(date: string, firstDate: string): string {
  return date === firstDate ? '/' : `/${date}/`;
}

export const LINEUP_URL = '/';

export const NOW_URL = '/now/';

/** The Explore page lists all artists. */
export const EXPLORE_URL = '/artists/';

/** GitHub opens the file in its editor and makes a fork for a user with no write access. */
export function editArtistDataUrl(artistId: string): string {
  return `${REPO_URL}/edit/main/data/artists/${artistId}.yml`;
}
