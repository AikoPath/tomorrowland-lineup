import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
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

test('photoUrl does not give the URL of a photo from a host with no proxy', () => {
  assert.throws(() => photoUrl('https://example.com/photo.jpg', 'small'), /No photo proxy for https:\/\/example\.com\/photo\.jpg/);
});

test('vercel.json has a rewrite for each photo proxy', async () => {
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(
    config.rewrites,
    PHOTO_PROXIES.map(({ path, origin }) => ({ source: `${path}/:path*`, destination: `${origin}/:path*` })),
  );
});
