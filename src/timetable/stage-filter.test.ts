import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daySelection, isStageShown, readStageSelection, toggleStage, withStageSelection } from './stage-filter.ts';

const stageIds = ['mainstage', 'freedom', 'core'];

test('reads the selected stages from the URL in the order of the stages', () => {
  assert.deepEqual(readStageSelection('?stage=core&stage=mainstage', stageIds), ['mainstage', 'core']);
});

test('ignores an id that is not a stage', () => {
  assert.deepEqual(readStageSelection('?stage=unknown&stage=core', stageIds), ['core']);
  assert.deepEqual(readStageSelection('?stage=unknown', stageIds), []);
});

test('keeps a selected stage that has no sets on the day', () => {
  const selection = readStageSelection('?stage=core&stage=freedom', stageIds);
  const dayStageIds = ['mainstage', 'core'];
  assert.deepEqual(daySelection(selection, dayStageIds), ['core']);
  const url = withStageSelection(new URL('https://example.com/2026-12-12/'), selection);
  assert.equal(url.search, '?stage=freedom&stage=core');
});

test('shows all stages when no selected stage has sets on the day', () => {
  const shown = daySelection(['freedom'], ['mainstage', 'core']);
  assert.deepEqual(shown, []);
  assert.equal(isStageShown(shown, 'mainstage'), true);
  assert.equal(isStageShown(shown, 'core'), true);
});

test('selects all stages when the URL has no stage', () => {
  const selection = readStageSelection('', stageIds);
  assert.deepEqual(selection, []);
  assert.equal(stageIds.every((id) => isStageShown(selection, id)), true);
});

test('lets the user select more than one stage', () => {
  const one = toggleStage([], 'core', stageIds);
  const two = toggleStage(one, 'mainstage', stageIds);
  assert.deepEqual(two, ['mainstage', 'core']);
  assert.equal(isStageShown(two, 'freedom'), false);
  assert.equal(isStageShown(two, 'core'), true);
});

test('removes a selected stage from the selection', () => {
  assert.deepEqual(toggleStage(['mainstage', 'core'], 'mainstage', stageIds), ['core']);
});

test('puts the selection in the URL and keeps the other parameters', () => {
  const url = withStageSelection(new URL('https://example.com/2026-12-12/?stage=freedom&x=1'), ['mainstage', 'core']);
  assert.equal(url.search, '?x=1&stage=mainstage&stage=core');
  assert.equal(withStageSelection(url, []).search, '?x=1');
});
