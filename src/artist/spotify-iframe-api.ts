/**
 * The Spotify iFrame API can start the player from a click on the page,
 * so that the user does not have to click "Play" a second time in the player.
 * https://developer.spotify.com/documentation/embeds/references/iframe-api
 */

export interface SpotifyController {
  play(): void;
  loadUri?(uri: string): void;
  loadEntity?(uri: string): void;
  destroy?(): void;
  addListener(event: 'ready', callback: () => void): void;
}

interface SpotifyIframeApi {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: string; height?: number },
    callback: (controller: SpotifyController) => void,
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
  }
}

let apiPromise: Promise<SpotifyIframeApi> | undefined;

function loadApi(): Promise<SpotifyIframeApi> {
  apiPromise ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    script.dataset.astroTransitionPersist = 'spotify-iframe-api';
    script.onerror = () => {
      // A later click can try again, for example after a network problem.
      apiPromise = undefined;
      reject(new Error('The Spotify iFrame API did not load'));
    };
    document.head.append(script);
  });
  return apiPromise;
}

/** Puts a Spotify player into `element` and starts it, returning the controller so later plays can reuse the iframe. */
export async function playSpotify(
  element: HTMLElement,
  uri: string,
  height: number,
  title: string,
): Promise<SpotifyController> {
  const api = await loadApi();
  const slot = document.createElement('div');
  element.replaceChildren(slot);
  return new Promise((resolve) => {
    api.createController(slot, { uri, width: '100%', height }, (controller) => {
      controller.addListener('ready', () => controller.play());
      const iframe = element.querySelector('iframe');
      if (iframe) iframe.title = title;
      resolve(controller);
    });
  });
}

/** Switches an existing Spotify controller to a new artist URI without recreating the iframe. */
export function loadSpotifyUri(controller: SpotifyController, uri: string): boolean {
  const loader = controller.loadEntity ?? controller.loadUri;
  if (!loader) return false;
  loader.call(controller, uri);
  controller.play();
  return true;
}
