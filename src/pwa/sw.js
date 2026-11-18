// The service worker keeps all files of the site and the artist photos on the phone, so the lineup also works with no network.
// The build adds CACHE_NAME, PRECACHE_URLS, SMALL_PHOTO_URLS, LARGE_PHOTO_URLS and SAVE_PHOTOS_MESSAGE above this code.
// See src/pwa/service-worker.ts.
/* global CACHE_NAME, PRECACHE_URLS, SMALL_PHOTO_URLS, LARGE_PHOTO_URLS, SAVE_PHOTOS_MESSAGE */

// On a slow festival network, show the saved page after this time.
const PAGE_NETWORK_TIMEOUT_MS = 3000;

// The artist photos stay in their own cache, so a new deploy downloads only new photos.
const PHOTO_CACHE = 'artist-photos';
// The photo URLs start with a path on the site domain. See src/artist/photo.ts.
const toAbsolute = (url) => new URL(url, self.location.origin).href;
const SMALL_PHOTOS = SMALL_PHOTO_URLS.map(toAbsolute);
const PHOTO_URLS = new Set([...SMALL_PHOTOS, ...LARGE_PHOTO_URLS.map(toAbsolute)]);
// On a slow network, a few downloads at a time leave space for the requests of the page.
const PHOTO_DOWNLOADS_AT_A_TIME = 4;

// The install saves only the pages and the files of the site. A photo can then not stop the offline pages.
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

self.addEventListener('message', (event) => {
  if (event.data === SAVE_PHOTOS_MESSAGE) event.waitUntil(saveSmallPhotos());
});

/**
 * Save the small photos that are not in the cache yet. Each page load tries again, so a photo that failed one time
 * gets saved on a later visit.
 */
async function saveSmallPhotos() {
  // With Data Saver on, the phone saves only the photos that the user sees.
  if (self.navigator.connection?.saveData) return;
  const cache = await caches.open(PHOTO_CACHE);
  const saved = new Set((await cache.keys()).map((request) => request.url));
  const queue = SMALL_PHOTOS.filter((url) => !saved.has(url));
  const download = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        await savePhoto(cache, url);
      } catch {
        // No network, or the storage is full. The page then shows the initials of the artist.
      }
    }
  };
  await Promise.all(Array.from({ length: PHOTO_DOWNLOADS_AT_A_TIME }, download));
}

/** The Accept header asks the Tomorrowland CDN for a WebP file, as an img element does. */
async function savePhoto(cache, url) {
  const response = await fetch(url, { headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' } });
  if (response.ok) await cache.put(url, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (PHOTO_URLS.has(request.url)) event.respondWith(photoResponse(request));
  else if (new URL(request.url).origin === self.location.origin)
    event.respondWith(request.mode === 'navigate' ? pageResponse(request) : fileResponse(request));
});

/**
 * Use the saved photo. Save a photo that is not in the cache, for example the large photo of an artist page.
 * The cache keeps only photos with a good status, so an error from the photo server does not stay.
 */
async function photoResponse(request) {
  const cache = await caches.open(PHOTO_CACHE);
  const saved = await cache.match(request, { ignoreVary: true });
  if (saved) return saved;
  try {
    return await savePhoto(cache, request.url);
  } catch {
    // The storage is full, or the network failed. Try the network one more time.
    return fetch(request);
  }
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
