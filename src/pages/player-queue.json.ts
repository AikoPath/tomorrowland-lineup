import type { APIRoute } from 'astro';
import { previewPlayers } from '../artist/music-player.ts';
import { loadLineup } from '../data/load.ts';
import type { PlayerTrack } from '../player/player-state.ts';
import { artistUrl } from '../urls.ts';

/** Static fallback queue of all playable artists, used when playback starts outside a list (e.g. an artist page). */
export const GET: APIRoute = async () => {
  const lineup = await loadLineup();
  const tracks: PlayerTrack[] = lineup.artists.flatMap((artist) => {
    const players = previewPlayers(artist);
    return players.length > 0
      ? [{ artistId: artist.id, artistName: artist.name, artistUrl: artistUrl(artist.id), players }]
      : [];
  });
  return new Response(JSON.stringify(tracks), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
