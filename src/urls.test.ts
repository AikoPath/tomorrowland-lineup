import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayUrl, editArtistDataUrl } from './urls.ts';

test('editArtistDataUrl opens the YAML file of the artist in the GitHub editor', () => {
  assert.equal(
    editArtistDataUrl('charlotte-de-witte'),
    'https://github.com/AikoPath/tomorrowland-lineup/edit/main/data/artists/charlotte-de-witte.yml',
  );
});

// The home page sends the user to the page of today. A link to the first day must not go to the home page.
test('dayUrl gives the first festival day its own page', () => {
  assert.equal(dayUrl('2026-12-11'), '/2026-12-11/');
});
