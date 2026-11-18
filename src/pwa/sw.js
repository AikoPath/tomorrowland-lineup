// The service worker keeps all files of the site on the phone, so the lineup also works with no network.
// The build adds CACHE_NAME, PRECACHE_URLS, SMALL_PHOTO_URLS and LARGE_PHOTO_URLS above this code.
// See src/pwa/service-worker.ts.
/* global CACHE_NAME, PRECACHE_URLS, SMALL_PHOTO_URLS, LARGE_PHOTO_URLS */

// On a slow festival network, show the saved page after this time.
const PAGE_NETWORK_TIMEOUT_MS = 3000;

// The artist photos stay in their own cache, so a new deploy downloads only new photos.
const PHOTO_CACHE = 'artist-photos';
const PHOTO_URLS = new Set([...SMALL_PHOTO_URLS, ...LARGE_PHOTO_URLS]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)), saveSmallPhotos()]).then(() =>
      self.skipWaiting(),
    ),
  );
});

/** A photo that does not load does not stop the install. The page then shows the initials of the artist. */
async function saveSmallPhotos() {
  // With Data Saver on, the phone saves only the photos that the user sees.
  if (self.navigator.connection?.saveData) return;
  const cache = await caches.open(PHOTO_CACHE);
  const saved = new Set((await cache.keys()).map((request) => request.url));
  await Promise.allSettled(
    SMALL_PHOTO_URLS.filter((url) => !saved.has(url)).map(async (url) => {
      const response = await fetch(photoRequest(url));
      if (isUsable(response)) await cache.put(url, response);
    }),
  );
}

/**
 * The photo servers do not allow other sites to read the photos, so the request uses the "no-cors" mode.
 * The Accept header asks the Tomorrowland CDN for a WebP file, as an img element does.
 */
function photoRequest(url) {
  return new Request(url, { mode: 'no-cors', headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' } });
}

/** A "no-cors" response is opaque: its status is always 0, so the service worker cannot see an error. */
function isUsable(response) {
  return response.ok || response.type === 'opaque';
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => name !== CACHE_NAME && name !== PHOTO_CACHE).map((name) => caches.delete(name)),
        ),
      )
      .then(removeOldPhotos)
      .then(() => self.clients.claim()),
  );
});

/** Remove the photos that the data no longer uses, for example after a change of the photo of an artist. */
async function removeOldPhotos() {
  const cache = await caches.open(PHOTO_CACHE);
  const requests = await cache.keys();
  await Promise.all(requests.filter((request) => !PHOTO_URLS.has(request.url)).map((request) => cache.delete(request)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (PHOTO_URLS.has(request.url)) event.respondWith(photoResponse(request));
  else if (new URL(request.url).origin === self.location.origin)
    event.respondWith(request.mode === 'navigate' ? pageResponse(request) : fileResponse(request));
});

/** Use the saved photo. Save a photo that is not in the cache, for example the large photo of an artist page. */
async function photoResponse(request) {
  const cache = await caches.open(PHOTO_CACHE);
  const saved = await cache.match(request, { ignoreVary: true });
  if (saved) return saved;
  const response = await fetch(request);
  if (!isUsable(response)) return response;
  // Chrome does not show an opaque response after a clone, so save the response and give the saved copy.
  try {
    await cache.put(request.url, response);
  } catch {
    // The storage is full. The browser cache can still give the photo.
    return fetch(request);
  }
  return (await cache.match(request.url)) ?? fetch(request);
}

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
