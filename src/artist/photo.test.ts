import assert from 'node:assert/strict';
import { test } from 'node:test';
import { photoUrl } from './photo.ts';

test('photoUrl asks the Tomorrowland CDN for a resized photo', () => {
  const image = 'https://artist-lineup-cdn.tomorrowland.com/240493521-EliFurEdit-5.tiff';
  assert.equal(photoUrl(image, 'small'), `${image}?width=400`);
  assert.equal(photoUrl(image, 'large'), `${image}?width=800`);
});

test('photoUrl keeps the encoded characters of the file name', () => {
  assert.equal(
    photoUrl('https://artist-lineup-assets.b-cdn.net/16613705-large-AdamK%20-%20UpClose.jpg', 'small'),
    'https://artist-lineup-assets.b-cdn.net/16613705-large-AdamK%20-%20UpClose.jpg?width=400',
  );
});

test('photoUrl uses the 320 px Spotify photo for the small size', () => {
  const image = 'https://i.scdn.co/image/ab6761610000e5eb0cb0d65b77539ed30fa1ebc6';
  assert.equal(photoUrl(image, 'small'), 'https://i.scdn.co/image/ab676161000051740cb0d65b77539ed30fa1ebc6');
  assert.equal(photoUrl(image, 'large'), image);
});

test('photoUrl keeps the URL of a photo from a different host', () => {
  assert.equal(photoUrl('https://example.com/photo.jpg', 'small'), 'https://example.com/photo.jpg');
});
