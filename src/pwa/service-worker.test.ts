import assert from 'node:assert/strict';
import { test } from 'node:test';
import { artistPhotoUrls, buildFileUrl, cacheName } from './service-worker.ts';

test('buildFileUrl gives the page URL with a slash for an index.html file', () => {
  assert.equal(buildFileUrl('index.html'), '/');
  assert.equal(buildFileUrl('now/index.html'), '/now/');
  assert.equal(buildFileUrl('artists/charlotte-de-witte/index.html'), '/artists/charlotte-de-witte/');
});

test('buildFileUrl gives the path of a file that is not a page', () => {
  assert.equal(buildFileUrl('_astro/now.CPleTxwE.css'), '/_astro/now.CPleTxwE.css');
  assert.equal(buildFileUrl('manifest.webmanifest'), '/manifest.webmanifest');
});

test('cacheName changes when the content of a file changes', () => {
  const before = cacheName([{ file: 'index.html', content: Buffer.from('a') }]);
  const after = cacheName([{ file: 'index.html', content: Buffer.from('b') }]);
  assert.notEqual(before, after);
  assert.equal(before, cacheName([{ file: 'index.html', content: Buffer.from('a') }]));
});

test('artistPhotoUrls gives each photo one time, in the small and the large size', () => {
  const image = 'https://artist-lineup-cdn.tomorrowland.com/1-photo.jpg';
  assert.deepEqual(
    artistPhotoUrls([
      { id: 'a', name: 'A', image },
      { id: 'b', name: 'B', image },
      { id: 'c', name: 'C' },
    ]),
    { small: ['/photos/tml/1-photo.jpg?width=400'], large: ['/photos/tml/1-photo.jpg?width=800'] },
  );
});
