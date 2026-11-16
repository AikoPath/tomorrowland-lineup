import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  convertLineup,
  daySetsYaml,
  festivalDay,
  mergeArtistYaml,
  mergeStagesYaml,
  toId,
  type ImportedArtist,
  type TomorrowlandArtist,
  type TomorrowlandPerformance,
} from './convert.ts';

const mainstage = { id: '1', name: 'MAINSTAGE' };

function performance(artists: TomorrowlandArtist[], start = '20:00', end = '21:00:01'): TomorrowlandPerformance {
  return {
    artists,
    stage: mainstage,
    date: '2026-12-11',
    startTime: `2026-12-11 ${start}+07:00`,
    endTime: `2026-12-11 ${end}+07:00`,
  };
}

test('makes ids from names', () => {
  assert.equal(toId('Kölsch'), 'kolsch');
  assert.equal(toId('Eli & Fur'), 'eli-fur');
  assert.equal(toId('An!ka'), 'anka');
  assert.equal(toId('TA:REK'), 'tarek');
  assert.equal(toId('X CLUB.'), 'x-club');
  assert.equal(toId('HALŌ'), 'halo');
  assert.throws(() => toId('!!'));
});

test('converts sets with local times to the minute, sorted by start', () => {
  const lineup = convertLineup(
    [mainstage],
    [
      performance([{ id: 'a', name: 'Amelie Lens' }], '23:30', '23:59:01'),
      performance([{ id: 'b', name: 'Kevin de Vries' }, { id: 'c', name: 'MORTEN' }], '22:00', '23:30:01'),
    ],
  );
  assert.deepEqual(lineup.stages, [{ id: 'mainstage', name: 'MAINSTAGE' }]);
  assert.deepEqual(lineup.days.get('2026-12-11'), [
    { artists: ['kevin-de-vries', 'morten'], stage: 'mainstage', start: '2026-12-11T22:00', end: '2026-12-11T23:30' },
    { artists: ['amelie-lens'], stage: 'mainstage', start: '2026-12-11T23:30', end: '2026-12-11T23:59' },
  ]);
});

test('puts a set that starts after midnight in the festival day before', () => {
  const lineup = convertLineup(
    [mainstage],
    [
      performance([{ id: 'a', name: 'Amelie Lens' }], '23:00', '23:59:01'),
      {
        artists: [{ id: 'b', name: 'Ferry Corsten' }],
        stage: mainstage,
        date: '2026-12-12',
        startTime: '2026-12-12 00:00:00+07:00',
        endTime: '2026-12-12 01:00:01+07:00',
      },
    ],
  );
  assert.deepEqual([...lineup.days.keys()], ['2026-12-11']);
  assert.deepEqual(
    lineup.days.get('2026-12-11')?.map((set) => set.start),
    ['2026-12-11T23:00', '2026-12-12T00:00'],
  );
});

test('finds the festival day of a start time', () => {
  assert.equal(festivalDay('2026-12-11T13:00'), '2026-12-11');
  assert.equal(festivalDay('2026-12-12T00:00'), '2026-12-11');
  assert.equal(festivalDay('2026-12-12T05:59'), '2026-12-11');
  assert.equal(festivalDay('2026-12-12T06:00'), '2026-12-12');
  assert.equal(festivalDay('2027-01-01T01:00'), '2026-12-31');
});

test('skips "More to be announced" entries', () => {
  const lineup = convertLineup([mainstage], [performance([{ id: 'x', name: 'More to be announced' }])]);
  assert.deepEqual(lineup.artists, []);
  assert.equal(lineup.days.size, 0);
});

test('maps the artist fields and cleans the links', () => {
  const [artist] = convertLineup(
    [mainstage],
    [
      performance([
        {
          id: 'm',
          name: 'MANDY',
          image: 'https://artist-lineup-cdn.tomorrowland.com/lf bg v3.jpg',
          twitter: 'https://twitter.com/mandy',
          youtube: 'DJ MANDY - https://www.youtube.com/channel/UCsFcbYXC0IGlDbV5FyQMjGw',
          spotify: 'https://open.spotify.com/artist/123',
        },
      ]),
    ],
  ).artists;
  assert.deepEqual(artist.fields, [
    { path: ['image'], value: 'https://artist-lineup-cdn.tomorrowland.com/lf%20bg%20v3.jpg' },
    { path: ['social', 'x'], value: 'https://twitter.com/mandy' },
    { path: ['music', 'spotify'], value: 'https://open.spotify.com/artist/123' },
    { path: ['music', 'youtube'], value: 'https://www.youtube.com/channel/UCsFcbYXC0IGlDbV5FyQMjGw' },
  ]);
});

test('skips links that the schema rejects, with a warning', () => {
  const lineup = convertLineup(
    [mainstage],
    [performance([{ id: 'a', name: 'Afrojack', youtube: 'https://www.youtube.com/user/afrojacktv', instagram: 'n/a' }])],
  );
  assert.deepEqual(lineup.artists[0].fields, []);
  assert.deepEqual(lineup.warnings, [
    'Afrojack: skipped instagram "n/a": Expected a URL',
    'Afrojack: skipped youtube "https://www.youtube.com/user/afrojacktv": Use the https://www.youtube.com/channel/UC… form',
  ]);
});

test('uses the id override, and stops when two artists get the same id', () => {
  const artists = [
    { id: '1', name: 'Halo' },
    { id: '2', name: 'HALŌ' },
  ];
  assert.throws(() => convertLineup([mainstage], [performance(artists)], {}), /Two artists have the id "halo"/);
  const lineup = convertLineup([mainstage], [performance(artists)], { Halo: 'halo-thailand' });
  assert.deepEqual(
    lineup.artists.map((artist) => artist.id),
    ['halo-thailand', 'halo'],
  );
});

const imported: ImportedArtist = {
  id: 'amelie-lens',
  name: 'Amelie Lens',
  fields: [
    { path: ['image'], value: 'https://cdn.example/amelie.png' },
    { path: ['social', 'instagram'], value: 'https://www.instagram.com/amelie_lens' },
  ],
};

test('writes a new artist file', () => {
  assert.equal(
    mergeArtistYaml(undefined, imported),
    'name: Amelie Lens\nimage: https://cdn.example/amelie.png\nsocial:\n  instagram: https://www.instagram.com/amelie_lens\n',
  );
});

test('fills only the empty fields of an artist file and keeps comments', () => {
  const existing = [
    '# Name from the press kit',
    'name: AMELIE LENS',
    'genres: [techno]',
    'social:',
    '  instagram: https://www.instagram.com/amelielens_fixed',
    '  tiktok: https://www.tiktok.com/@amelie',
    '',
  ].join('\n');
  assert.equal(
    mergeArtistYaml(existing, imported),
    [
      '# Name from the press kit',
      'name: AMELIE LENS',
      'genres: [techno]',
      'social:',
      '  instagram: https://www.instagram.com/amelielens_fixed',
      '  tiktok: https://www.tiktok.com/@amelie',
      'image: https://cdn.example/amelie.png',
      '',
    ].join('\n'),
  );
});

test('keeps the image that a contributor added', () => {
  const existing = [
    'name: Amelie Lens',
    'image: https://i.scdn.co/image/amelie',
    'social:',
    '  instagram: https://www.instagram.com/amelie_lens',
    '',
  ].join('\n');
  assert.equal(mergeArtistYaml(existing, imported), undefined);
});

test('leaves a complete artist file unchanged', () => {
  const complete = mergeArtistYaml(undefined, imported)!;
  assert.equal(mergeArtistYaml(complete, imported), undefined);
});

test('adds missing stages and keeps the names in stages.yml', () => {
  const stages = [
    { id: 'mainstage', name: 'MAINSTAGE' },
    { id: 'core', name: 'CORE' },
  ];
  assert.equal(
    mergeStagesYaml('- id: mainstage\n  name: Mainstage\n', stages),
    '- id: mainstage\n  name: Mainstage\n- id: core\n  name: CORE\n',
  );
  assert.equal(mergeStagesYaml('- id: mainstage\n  name: Mainstage\n- id: core\n  name: Core\n', stages), undefined);
});

test('writes a day file with the artists on one line', () => {
  const yaml = daySetsYaml([
    { artists: ['a', 'b'], stage: 'mainstage', start: '2026-12-11T22:00', end: '2026-12-11T23:30' },
  ]);
  assert.match(yaml, /^# npm run import:lineup writes this file/);
  assert.match(yaml, /\n- artists: \[a, b\]\n  stage: mainstage\n  start: 2026-12-11T22:00\n  end: 2026-12-11T23:30\n$/);
});
