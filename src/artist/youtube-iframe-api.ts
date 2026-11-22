/**
 * The YouTube IFrame Player API lets us switch artist upload playlists inside the same iframe
 * via `loadPlaylist(...)` without destroying and recreating the iframe.
 * https://developers.google.com/youtube/iframe_api_reference
 */

interface YouTubePlayer {
  playVideo(): void;
  loadPlaylist(options: { list: string; listType: 'playlist'; index?: number; startSeconds?: number }): void;
  destroy(): void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: { onReady?: (event: { target: YouTubePlayer }) => void };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | undefined;

function loadApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        apiPromise = undefined;
        reject(new Error('The YouTube IFrame API did not initialize'));
      }
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.dataset.astroTransitionPersist = 'youtube-iframe-api';
    script.onerror = () => {
      apiPromise = undefined;
      reject(new Error('The YouTube IFrame API did not load'));
    };
    document.head.append(script);
  });
  return apiPromise;
}

export interface YouTubeHandle {
  loadPlaylist(playlistId: string): boolean;
  destroy(): void;
}

/** Mounts a privacy-enhanced YouTube player and returns a handle that switches playlists in-place. */
export async function playYouTube(
  element: HTMLElement,
  playlistId: string,
  title: string,
): Promise<YouTubeHandle> {
  const yt = await loadApi();
  const host = document.createElement('div');
  element.replaceChildren(host);

  let ready = false;
  let destroyed = false;
  let pendingPlaylistId: string | undefined;

  const player = new yt.Player(host, {
    host: 'https://www.youtube-nocookie.com',
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 1,
      playsinline: 1,
      listType: 'playlist',
      list: playlistId,
      origin: location.origin,
    },
    events: {
      onReady: (event) => {
        if (destroyed) return;
        ready = true;
        if (pendingPlaylistId) {
          const next = pendingPlaylistId;
          pendingPlaylistId = undefined;
          event.target.loadPlaylist({ list: next, listType: 'playlist', index: 0, startSeconds: 0 });
        } else {
          event.target.playVideo();
        }
      },
    },
  });

  const iframe = element.querySelector('iframe');
  if (iframe) iframe.title = title;

  return {
    loadPlaylist(nextPlaylistId: string): boolean {
      if (destroyed || !element.querySelector('iframe')) return false;
      if (!ready) {
        pendingPlaylistId = nextPlaylistId;
        return true;
      }
      player.loadPlaylist({ list: nextPlaylistId, listType: 'playlist', index: 0, startSeconds: 0 });
      return true;
    },
    destroy() {
      destroyed = true;
      try {
        player.destroy();
      } catch {
        // Ignore teardown errors if the iframe was already removed.
      }
    },
  };
}
