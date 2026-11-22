import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadLineup } from '../data/load.ts';
import { PHOTO_PROXIES, photoUrl } from './photo.ts';

test('photoUrl asks the Tomorrowland CDN for a resized photo through the site domain', () => {
  const image = 'https://artist-lineup-cdn.tomorrowland.com/240493521-EliFurEdit-5.tiff';
  assert.equal(photoUrl(image, 'small'), '/photos/tml/240493521-EliFurEdit-5.tiff?width=400');
  assert.equal(photoUrl(image, 'large'), '/photos/tml/240493521-EliFurEdit-5.tiff?width=800');
});

test('photoUrl keeps the encoded characters of the file name', () => {
  assert.equal(
    photoUrl('https://artist-lineup-assets.b-cdn.net/16613705-large-AdamK%20-%20UpClose.jpg', 'small'),
    '/photos/bunny/16613705-large-AdamK%20-%20UpClose.jpg?width=400',
  );
});

test('photoUrl uses the 320 px Spotify photo for the small size', () => {
  const image = 'https://i.scdn.co/image/ab6761610000e5eb0cb0d65b77539ed30fa1ebc6';
  assert.equal(photoUrl(image, 'small'), '/photos/spotify/image/ab676161000051740cb0d65b77539ed30fa1ebc6');
  assert.equal(photoUrl(image, 'large'), '/photos/spotify/image/ab6761610000e5eb0cb0d65b77539ed30fa1ebc6');
});

test('photoUrl keeps the URL of a photo from a different host', () => {
  assert.equal(photoUrl('https://example.com/photo.jpg', 'small'), 'https://example.com/photo.jpg');
});

// The service worker can read only a photo on the site domain. A photo from a different host gives a CORS error.
test('each artist photo in the data has a photo proxy', async () => {
  const { artists } = await loadLineup();
  const images = artists.flatMap((artist) => (artist.image ? [artist.image] : []));
  assert.deepEqual(images.filter((image) => photoUrl(image, 'small').startsWith('https://')), []);
});

test('photoUrl keeps the special characters of a Resident Advisor photo', () => {
  assert.equal(
    photoUrl('https://static.ra.co/images/profiles/square/an!ka.jpg?dateUpdated=1750247427000', 'small'),
    '/photos/ra/images/profiles/square/an!ka.jpg?dateUpdated=1750247427000',
  );
});

test('vercel.json has a rewrite for each photo proxy', async () => {
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(
    config.rewrites,
    PHOTO_PROXIES.map(({ path, origin }) => ({ source: `${path}/:path*`, destination: `${origin}/:path*` })),
  );
});
