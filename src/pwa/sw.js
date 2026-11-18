// The service worker keeps all files of the site on the phone, so the lineup also works with no network.
// The build adds CACHE_NAME and PRECACHE_URLS above this code. See src/pwa/service-worker.ts.
/* global CACHE_NAME, PRECACHE_URLS */

// On a slow festival network, show the saved page after this time.
const PAGE_NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(request.mode === 'navigate' ? pageResponse(request) : fileResponse(request));
});

/** Get the newest page from the network. Use the saved page when the network fails or is too slow. */
async function pageResponse(request) {
  const network = fetch(request);
  // When the saved page wins, a later network error must not show as an unhandled error.
  network.catch(() => {});
  const timeout = new Promise((resolve) => setTimeout(resolve, PAGE_NETWORK_TIMEOUT_MS));
  try {
    const response = await Promise.race([network, timeout]);
    if (response) return response;
    return (await savedPage(request)) ?? (await network);
  } catch {
    return (await savedPage(request)) ?? Response.error();
  }
}

/** The page links end with a slash, but a user can type the URL with no slash. */
async function savedPage(request) {
  const url = new URL(request.url);
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  const options = { ignoreSearch: true, ignoreVary: true };
  return (await caches.match(request, options)) ?? (await caches.match(url.href, options));
}

/**
 * The cache contains the files of the same build as this service worker. A new build installs a new service worker.
 * A font request sends an Origin header, so the match ignores the Vary header of the response.
 */
async function fileResponse(request) {
  return (await caches.match(request, { ignoreVary: true })) ?? fetch(request);
}
