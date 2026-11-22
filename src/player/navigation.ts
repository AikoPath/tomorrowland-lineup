import { SIGN_IN_URL } from '../urls.ts';
import { rememberPreviousUrl } from './player-state.ts';

declare global {
  interface Window {
    /** Set after the first soft swap so cold-load inline redirects do not trigger a full reload. */
    __astroSoftNav?: boolean;
  }
}

let pageGeneration = 0;
let previousNonSignInUrl: string | undefined;

if (typeof document !== 'undefined') {
  document.addEventListener('astro:after-swap', () => {
    pageGeneration += 1;
  });
}

/** Records `fromUrl` before a soft swap so the sign-in screen can return to it. */
export function recordNavigationFrom(fromUrl: string | URL): void {
  const remembered = rememberPreviousUrl(fromUrl, location.origin, SIGN_IN_URL);
  if (remembered) previousNonSignInUrl = remembered;
}

/** Returns the last non-sign-in page visited in this session, or `document.referrer` on a cold load. */
export function getPreviousNonSignInUrl(): string | undefined {
  return (
    previousNonSignInUrl ?? rememberPreviousUrl(document.referrer, location.origin, SIGN_IN_URL)
  );
}

/**
 * Runs `setup` once for the current page and again on every subsequent soft navigation.
 * The `AbortSignal` aborts automatically on `astro:before-swap` so listeners and timers never leak.
 */
export function onPageMount(setup: (signal: AbortSignal) => void): void {
  let lastMountedGeneration = -1;
  let controller: AbortController | undefined;

  function mount() {
    if (lastMountedGeneration === pageGeneration) return;
    lastMountedGeneration = pageGeneration;
    controller?.abort();
    controller = new AbortController();
    setup(controller.signal);
  }

  document.addEventListener('astro:before-swap', () => {
    controller?.abort();
    controller = undefined;
  });
  document.addEventListener('astro:page-load', mount);

  mount();
}
