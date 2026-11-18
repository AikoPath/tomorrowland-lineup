import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSetDimmed, readHighlight, withHighlight } from './favourite-highlight.ts';

test('reads the state of the switch from the URL', () => {
  assert.equal(readHighlight('?favourites'), true);
  assert.equal(readHighlight('?stage=core&favourites='), true);
  assert.equal(readHighlight('?stage=core'), false);
  assert.equal(readHighlight(''), false);
});

test('puts the state of the switch in the URL and keeps the other parameters', () => {
  const url = withHighlight(new URL('https://example.com/2026-12-12/?stage=core'), true);
  assert.equal(readHighlight(url.search), true);
  assert.equal(url.searchParams.getAll('stage').join(), 'core');
  assert.equal(withHighlight(url, false).search, '?stage=core');
});

test('dims only the sets that are not favourites when the switch is on', () => {
  const favourites = new Set(['2026-12-11/martin-garrix']);
  assert.equal(isSetDimmed(true, favourites, '2026-12-11/martin-garrix'), false);
  assert.equal(isSetDimmed(true, favourites, '2026-12-11/alan-walker'), true);
});

test('dims no set when the switch is off', () => {
  assert.equal(isSetDimmed(false, new Set(), '2026-12-11/alan-walker'), false);
});
