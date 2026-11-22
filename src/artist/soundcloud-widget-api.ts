/**
 * The SoundCloud Widget API lets us switch artists inside an existing SoundCloud iframe
 * with `widget.load(url, { auto_play: true })` instead of destroying and recreating the iframe.
 * https://developers.soundcloud.com/docs/api/html5-widget
 */

export interface SoundCloudWidget {
  load(url: string, options?: { auto_play?: boolean; callback?: () => void }): void;
}

interface SoundCloudApi {
  Widget(iframe: HTMLIFrameElement): SoundCloudWidget;
}

declare global {
  interface Window {
    SC?: SoundCloudApi;
  }
}

let apiPromise: Promise<SoundCloudApi> | undefined;

function loadApi(): Promise<SoundCloudApi> {
  if (window.SC?.Widget) return Promise.resolve(window.SC);
  apiPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://w.soundcloud.com/player/api.js';
    script.async = true;
    script.dataset.astroTransitionPersist = 'soundcloud-widget-api';
    script.onload = () => {
      if (window.SC?.Widget) {
        resolve(window.SC);
      } else {
        apiPromise = undefined;
        reject(new Error('The SoundCloud Widget API did not initialize'));
      }
    };
    script.onerror = () => {
      apiPromise = undefined;
      reject(new Error('The SoundCloud Widget API did not load'));
    };
    document.head.append(script);
  });
  return apiPromise;
}

export interface SoundCloudHandle {
  iframe: HTMLIFrameElement;
  load(artistUrl: string): Promise<boolean>;
}

/** Mounts a SoundCloud iframe and returns a handle that switches artists in-place via the Widget API. */
export function createSoundCloudHandle(
  element: HTMLElement,
  embedSrc: string,
  title: string,
): SoundCloudHandle {
  const iframe = document.createElement('iframe');
  iframe.src = embedSrc;
  iframe.title = title;
  iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  element.replaceChildren(iframe);

  // Preload the Widget API in the background so the next artist click switches immediately.
  const widgetPromise = loadApi()
    .then((sc) => sc.Widget(iframe))
    .catch(() => undefined);

  return {
    iframe,
    async load(artistUrl: string): Promise<boolean> {
      const widget = await widgetPromise;
      if (!widget || !iframe.isConnected) return false;
      widget.load(artistUrl, { auto_play: true });
      return true;
    },
  };
}
