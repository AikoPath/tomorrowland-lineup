/** The URL keeps the switch, so that the highlight stays when the user changes the day. */
export const FAVOURITES_PARAM = 'favourites';

export function readHighlight(search: string): boolean {
  return new URLSearchParams(search).has(FAVOURITES_PARAM);
}

/** Puts the state of the switch in the URL and keeps the other parts of the URL. */
export function withHighlight(url: URL, highlight: boolean): URL {
  const result = new URL(url);
  result.searchParams.delete(FAVOURITES_PARAM);
  if (highlight) result.searchParams.set(FAVOURITES_PARAM, '');
  return result;
}

/** With the switch on, the sets that are not favourites are pale. */
export function isSetDimmed(highlight: boolean, favourites: Set<string>, setKey: string): boolean {
  return highlight && !favourites.has(setKey);
}
