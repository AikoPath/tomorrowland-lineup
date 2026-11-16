export function artistUrl(artistId: string): string {
  return `/artists/${artistId}/`;
}

/** The home page shows the first festival day. Each other day has its own page. */
export function dayUrl(date: string, firstDate: string): string {
  return date === firstDate ? '/' : `/${date}/`;
}

export const ARTIST_LIST_URL = '/artists/';
