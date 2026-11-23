import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { LineupDataError, loadLineup } from './load.ts';

const validFiles = {
  'stages.yml': '- id: mainstage\n  name: Mainstage\n- id: freedom\n  name: Freedom\n',
  'artists/amelie-lens.yml': [
    'name: Amelie Lens',
    'image: https://artist-lineup-cdn.tomorrowland.com/amelie.png',
    'genres: [techno]',
    'social:',
    '  instagram: https://www.instagram.com/amelie_lens',
    'music:',
    '  youtube: https://www.youtube.com/watch?v=abcdefghijk',
  ].join('\n'),
  'artists/charlotte-de-witte.yml': 'name: Charlotte de Witte\n',
  'sets/2026-12-11.yml': [
    '- artists: [charlotte-de-witte]',
    '  stage: freedom',
    '  start: 2026-12-11T23:30',
    '  end: 2026-12-12T01:00',
    '- artists: [amelie-lens, charlotte-de-witte]',
    '  stage: mainstage',
    '  start: 2026-12-11T22:00',
    '  end: 2026-12-11T23:30',
  ].join('\n'),
};

async function writeData(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'lineup-data-'));
  for (const [name, contents] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), contents);
  }
  return dir;
}

async function problemsFor(files: Record<string, string>): Promise<string[]> {
  try {
    await loadLineup(await writeData(files));
  } catch (error) {
    if (error instanceof LineupDataError) return error.problems.map((problem) => problem.replace(/^.*lineup-data-\w+\//, ''));
    throw error;
  }
  assert.fail('Expected a LineupDataError');
}

test('loads valid data, sorted', async () => {
  const lineup = await loadLineup(await writeData(validFiles));
  assert.deepEqual(
    lineup.artists.map((artist) => artist.id),
    ['amelie-lens', 'charlotte-de-witte'],
  );
  assert.deepEqual(lineup.days.map((day) => day.date), ['2026-12-11']);
  assert.deepEqual(
    lineup.days[0].sets.map((set) => set.start),
    ['2026-12-11T22:00', '2026-12-11T23:30'],
  );
  assert.deepEqual(lineup.days[0].sets[0].artists, ['amelie-lens', 'charlotte-de-witte']);
});

test('loads an empty data directory', async () => {
  assert.deepEqual(await loadLineup(await writeData({})), { stages: [], artists: [], days: [] });
});

test('rejects an unknown key', async () => {
  const problems = await problemsFor({ ...validFiles, 'artists/charlotte-de-witte.yml': 'name: C\ntwitter: x\n' });
  assert.deepEqual(problems, ['artists/charlotte-de-witte.yml: Unrecognized key: "twitter"']);
});

test('rejects a value that is not an https URL', async () => {
  const problems = await problemsFor({
    ...validFiles,
    'artists/charlotte-de-witte.yml': 'name: C\nimage: not a url\nsocial:\n  website: http://example.com\n',
  });
  assert.deepEqual(problems, [
    'artists/charlotte-de-witte.yml: image: Expected an https URL',
    'artists/charlotte-de-witte.yml: social.website: Expected an https URL',
  ]);
});

test('rejects a link to the wrong platform', async () => {
  const problems = await problemsFor({
    ...validFiles,
    'artists/charlotte-de-witte.yml': 'name: C\nmusic:\n  spotify: https://soundcloud.com/c\n',
  });
  assert.deepEqual(problems, ['artists/charlotte-de-witte.yml: music.spotify: Expected an https link to open.spotify.com']);
});

test('rejects a YouTube link without a video ID', async () => {
  const problems = await problemsFor({
    ...validFiles,
    'artists/charlotte-de-witte.yml': 'name: C\nmusic:\n  youtube: https://www.youtube.com/@charlottedewitte\n',
  });
  assert.deepEqual(problems, [
    'artists/charlotte-de-witte.yml: music.youtube: Use the https://www.youtube.com/watch?v=… form',
  ]);
});

test('rejects genres that are not lowercase', async () => {
  const problems = await problemsFor({ ...validFiles, 'artists/charlotte-de-witte.yml': 'name: C\ngenres: [Techno]\n' });
  assert.deepEqual(problems, ['artists/charlotte-de-witte.yml: genres[0]: Use lowercase']);
});

test('rejects a missing name', async () => {
  const problems = await problemsFor({ ...validFiles, 'artists/charlotte-de-witte.yml': 'genres: [techno]\n' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^artists\/charlotte-de-witte\.yml: name: /);
});

test('rejects unknown artist and stage ids', async () => {
  const problems = await problemsFor({
    ...validFiles,
    'sets/2026-12-11.yml': '- artists: [amelie-lens, nobody]\n  stage: atmosphere\n  start: 2026-12-11T20:00\n  end: 2026-12-11T21:00\n',
  });
  assert.deepEqual(problems, [
    'sets/2026-12-11.yml: [0].stage: Unknown stage "atmosphere". Add it to data/stages.yml or correct the id',
    'sets/2026-12-11.yml: [0].artists[1]: Unknown artist "nobody". Add data/artists/nobody.yml or correct the id',
  ]);
});

test('rejects a time without a date', async () => {
  const problems = await problemsFor({
    ...validFiles,
    'sets/2026-12-11.yml': '- artists: [amelie-lens]\n  stage: mainstage\n  start: "22:00"\n  end: 2026-12-11T23:00\n',
  });
  assert.deepEqual(problems, ['sets/2026-12-11.yml: [0].start: Expected a local time in the form YYYY-MM-DDTHH:MM']);
});

test('rejects a set that ends before it starts, or starts on another day', async () => {
  const problems = await problemsFor({
    ...validFiles,
    'sets/2026-12-11.yml': [
      '- artists: [amelie-lens]',
      '  stage: mainstage',
      '  start: 2026-12-11T22:00',
      '  end: 2026-12-11T21:00',
      '- artists: [amelie-lens]',
      '  stage: mainstage',
      '  start: 2026-12-21T22:00',
      '  end: 2026-12-21T23:00',
    ].join('\n'),
  });
  assert.deepEqual(problems, [
    'sets/2026-12-11.yml: [0].end: The end must be after the start',
    'sets/2026-12-11.yml: [1].start: Expected a start on 2026-12-11, or on 2026-12-12 after midnight',
  ]);
});

test('rejects bad file names and duplicate stage ids', async () => {
  const problems = await problemsFor({
    'stages.yml': '- id: mainstage\n  name: A\n- id: mainstage\n  name: B\n',
    'artists/Amelie_Lens.yml': 'name: Amelie Lens\n',
    'artists/amelie-lens.yaml': 'name: Amelie Lens\n',
    'sets/friday.yml': '[]\n',
  });
  assert.deepEqual(problems, [
    'stages.yml: [1].id: Duplicate stage id "mainstage"',
    'artists/Amelie_Lens.yml: The file name must be the artist id: lowercase letters, digits and single hyphens',
    'artists/amelie-lens.yaml: Use the .yml extension',
    'sets/friday.yml: The file name must be a date: YYYY-MM-DD',
  ]);
});

test('reports only the stages file when it is not valid', async () => {
  const problems = await problemsFor({ ...validFiles, 'stages.yml': '- id: mainstage\n' });
  assert.deepEqual(problems, ['stages.yml: [0].name: Invalid input: expected string, received undefined']);
});

test('reports YAML syntax errors with the line', async () => {
  const problems = await problemsFor({ ...validFiles, 'artists/charlotte-de-witte.yml': 'name: [unclosed\n' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^artists\/charlotte-de-witte\.yml: .*line \d+/);
});

test('lists the problems of all files in one error', async () => {
  const problems = await problemsFor({
    ...validFiles,
    'artists/amelie-lens.yml': 'name: A\nfoo: 1\n',
    'artists/charlotte-de-witte.yml': 'name: C\nbar: 1\n',
  });
  assert.equal(problems.length, 2);
});
