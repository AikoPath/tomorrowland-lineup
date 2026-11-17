import { REPO_URL } from './site.ts';

export function artistUrl(artistId: string): string {
  return `/artists/${artistId}/`;
}

/** The home page shows the first festival day. Each other day has its own page. */
export function dayUrl(date: string, firstDate: string): string {
  return date === firstDate ? '/' : `/${date}/`;
}

export const ARTIST_LIST_URL = '/artists/';

export const NOW_URL = '/now/';

/** GitHub opens the file in its editor and makes a fork for a user with no write access. */
export function editArtistDataUrl(artistId: string): string {
  return `${REPO_URL}/edit/main/data/artists/${artistId}.yml`;
}
