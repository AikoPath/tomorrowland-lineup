# Lineup data

The YAML files in this directory are the source of truth for the site. The Tomorrowland Thailand 2026 lineup is one source of the data. Other sources fill the gaps.

`npm run build` validates all files. The build stops and lists each problem with the file and the key.

```text
data/
├── stages.yml              All stages
├── artists/<artist-id>.yml One file for each artist
└── sets/<YYYY-MM-DD>.yml   The sets of one festival day
```

## Import from Tomorrowland

`npm run import:lineup` reads the Tomorrowland line-up JSON and writes the files in this directory. Run it again when Tomorrowland changes the lineup.

- Artist files: the import adds only the keys that are empty. It does not change a value that a contributor wrote.
- `stages.yml`: the import adds the stages that are missing. It does not change the names in the file.
- Set files: the import writes the file of each day again. Changes in a set file go away at the next import.

The import skips the "More to be announced" entries and each link that the schema does not accept. It writes a warning for each skipped link. At the end, it validates all files.

The import makes the ids from the names. If two names give the same id, the import stops. Then add the name and an id to `ARTIST_ID_OVERRIDES` in `scripts/import-lineup/convert.ts`, for example `Halo: 'halo-thailand'`.

## Ids

An id contains lowercase letters, digits and single hyphens, for example `charlotte-de-witte`. The name of an artist file is the artist id.

## `stages.yml`

A list of stages. Each stage has an `id` and a `name`.

```yaml
- id: mainstage
  name: Mainstage
- id: freedom
  name: Freedom
```

## `artists/<artist-id>.yml`

Only `name` is necessary. All other keys are optional.

```yaml
name: Example Artist
image: https://artist-lineup-cdn.tomorrowland.com/xxxx.png
genres:
  - techno
  - melodic techno
social:
  instagram: https://instagram.com/exampleartist
  tiktok: https://tiktok.com/@exampleartist
  x: https://x.com/exampleartist
  facebook: https://facebook.com/exampleartist
  website: https://exampleartist.com
music:
  spotify: https://open.spotify.com/artist/xxxx
  apple_music: https://music.apple.com/artist/xxxx
  youtube: https://www.youtube.com/channel/UCxxxx
  soundcloud: https://soundcloud.com/exampleartist
```

| Key             | Rule                                                                            |
| --------------- | ------------------------------------------------------------------------------- |
| `image`         | An https link to the Tomorrowland image. Do not copy image files into the repo. |
| `genres`        | A list of lowercase genre names.                                                |
| `social.*`      | An https link to the platform of the key. `x` also accepts `twitter.com` links. |
| `music.*`       | An https link to the artist page. A link to a song or album shows no player.    |
| `music.youtube` | Use the `/channel/UC…` form. The YouTube player needs the channel ID.           |

## `sets/<YYYY-MM-DD>.yml`

The file name is the date of the festival day. The file is a list of sets.

```yaml
- artists: [amelie-lens, charlotte-de-witte]
  stage: mainstage
  start: 2026-12-11T23:30
  end: 2026-12-12T01:00
```

- `artists`: one or more artist ids. A B2B set has more than one id.
- `stage`: a stage id from `stages.yml`.
- `start` and `end`: the local festival time in the form `YYYY-MM-DDTHH:MM`.

A set after midnight stays in the file of the festival day. Its `start` date is the next calendar day. The `end` must be after the `start`.
