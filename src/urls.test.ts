import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editArtistDataUrl } from './urls.ts';

test('editArtistDataUrl opens the YAML file of the artist in the GitHub editor', () => {
  assert.equal(
    editArtistDataUrl('charlotte-de-witte'),
    'https://github.com/AikoPath/tomorrowland-lineup/edit/main/data/artists/charlotte-de-witte.yml',
  );
});
