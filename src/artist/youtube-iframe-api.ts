/**
 * The YouTube IFrame Player API lets us switch artist videos inside the same iframe
 * via `loadVideoById(...)` without destroying and recreating the iframe.
 * https://developers.google.com/youtube/iframe_api_reference
 */

interface YouTubePlayer {
  playVideo(): void;
  loadVideoById(videoId: string): void;
  destroy(): void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string;
      width?: string | number;
      height?: string | number;
      videoId?: string;
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
  loadVideo(videoId: string): boolean;
  destroy(): void;
}

/** Mounts a privacy-enhanced YouTube player and returns a handle that switches videos in-place. */
export async function playYouTube(
  element: HTMLElement,
  videoId: string,
  title: string,
): Promise<YouTubeHandle> {
  const yt = await loadApi();
  const host = document.createElement('div');
  element.replaceChildren(host);

  let ready = false;
  let destroyed = false;
  let pendingVideoId: string | undefined;

  const player = new yt.Player(host, {
    host: 'https://www.youtube-nocookie.com',
    width: '100%',
    height: '100%',
    videoId,
    playerVars: {
      autoplay: 1,
      playsinline: 1,
      origin: location.origin,
    },
    events: {
      onReady: (event) => {
        if (destroyed) return;
        ready = true;
        if (pendingVideoId) {
          const next = pendingVideoId;
          pendingVideoId = undefined;
          event.target.loadVideoById(next);
        } else {
          event.target.playVideo();
        }
      },
    },
  });

  const iframe = element.querySelector('iframe');
  if (iframe) iframe.title = title;

  return {
    loadVideo(nextVideoId: string): boolean {
      if (destroyed || !element.querySelector('iframe')) return false;
      if (!ready) {
        pendingVideoId = nextVideoId;
        return true;
      }
      player.loadVideoById(nextVideoId);
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
