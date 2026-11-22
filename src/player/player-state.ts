import type { MusicKey } from '../artist/artist-page.ts';
import { choosePreview, type Player, type PreviewPlayer } from '../artist/music-player.ts';

export interface PlayerTrack {
  artistId: string;
  artistName: string;
  artistUrl: string;
  players: PreviewPlayer[];
}

export interface ResolvedTrackPlayer {
  service: MusicKey;
  player: Player;
  /** Set when the user chose a preferred service that this artist does not have, so another service plays instead. */
  fallbackFrom?: MusicKey;
}

export interface ActivePlayback {
  track: PlayerTrack;
  service: MusicKey;
  player: Player;
  fallbackFrom?: MusicKey;
  minimized: boolean;
}

/**
 * Picks the service and player to load for `track`.
 * An explicit `requestedService` (e.g. clicking a service tab) wins when the artist has it;
 * otherwise falls back to the user's preferred service or the artist's first available player.
 */
export function resolveTrackPlayer(
  track: PlayerTrack,
  preferredService: MusicKey | undefined,
  requestedService?: MusicKey,
): ResolvedTrackPlayer | undefined {
  if (requestedService) {
    const requested = track.players.find((candidate) => candidate.service === requestedService);
    if (requested) return { service: requested.service, player: requested.player };
  }
  const choice = choosePreview(track.players, preferredService);
  if (!choice) return undefined;
  return {
    service: choice.service,
    player: choice.player,
    fallbackFrom: preferredService && choice.service !== preferredService ? preferredService : undefined,
  };
}

/** Deduplicates tracks by artistId while keeping their original order. */
export function dedupeTracks(tracks: PlayerTrack[]): PlayerTrack[] {
  const seen = new Set<string>();
  const unique: PlayerTrack[] = [];
  for (const track of tracks) {
    if (seen.has(track.artistId)) continue;
    seen.add(track.artistId);
    unique.push(track);
  }
  return unique;
}

/**
 * Returns the previous (`-1`) or next (`+1`) artist in `queue` relative to `currentArtistId`,
 * wrapping around at the ends. Returns `undefined` when the queue has fewer than 2 artists.
 */
export function stepTrack(
  queue: readonly PlayerTrack[],
  currentArtistId: string,
  delta: -1 | 1,
): PlayerTrack | undefined {
  if (queue.length <= 1) return undefined;
  const index = queue.findIndex((track) => track.artistId === currentArtistId);
  if (index === -1) return delta === 1 ? queue[0] : queue.at(-1);
  return queue[(index + delta + queue.length) % queue.length];
}

/**
 * Returns `fromUrl` when it is a same-origin URL outside the sign-in flow so the sign-in screen's
 * close button can return to the page the user came from across soft navigations.
 */
export function rememberPreviousUrl(
  fromUrl: string | URL | null | undefined,
  currentOrigin: string,
  signInPrefix: string,
): string | undefined {
  if (!fromUrl) return undefined;
  try {
    const url = typeof fromUrl === 'string' ? new URL(fromUrl) : fromUrl;
    if (url.origin !== currentOrigin) return undefined;
    if (url.pathname.startsWith(signInPrefix)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
