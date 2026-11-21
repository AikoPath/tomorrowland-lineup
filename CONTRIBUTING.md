# Contribute lineup data

You can add or correct the data of an artist or a set with a pull request (PR). The YAML files in `data/` contain all the lineup data. [data/README.md](data/README.md) is the full reference for the format.

## Change an artist on GitHub

Each artist page has the button "Fix or add info" at the top right. You can do all steps in your browser.

1. Open the artist page on the site.
2. Click "Fix or add info".
3. Change the YAML file in the GitHub editor.
4. Click "Commit changes" and then "Propose changes".
5. Click "Create pull request".

If you do not have write access to the repo, GitHub makes a fork for you.

## Change the data on your computer

1. Fork the repo and clone the fork.
2. Run `npm install`.
3. Change or add the files in `data/`.
4. Run `npm run build` to validate all data files.
5. Push the branch to your fork and open a PR.

The build stops on each problem in the data. It shows the file and the key of each problem.

## Example artist file

The name of the file is the artist id, for example `data/artists/example-artist.yml`. An id contains lowercase letters, digits and single hyphens.

```yaml
name: Example Artist
image: https://artist-lineup-cdn.tomorrowland.com/xxxx.png
genres:
  - techno
  - melodic techno
social:
  instagram: https://www.instagram.com/exampleartist
  website: https://exampleartist.com
music:
  spotify: https://open.spotify.com/artist/xxxx
  youtube: https://www.youtube.com/channel/UCxxxx
```

- Only `name` is necessary. Add the other keys when you know the values.
- Write genres in lowercase.
- Use only https links to the platform of the key.
- For `music.youtube`, use the `/channel/UC…` form of the link.
- For `image`, use a link to `artist-lineup-cdn.tomorrowland.com`, `artist-lineup-assets.b-cdn.net` or `i.scdn.co`. The build stops on a link to a different host.
- Do not copy image files into the repo.

The import from Tomorrowland does not change a value that you write in an artist file.

## Example set

The sets of one festival day are in `data/sets/<YYYY-MM-DD>.yml`. Add a set to the list in the file of its festival day.

```yaml
- artists: [example-artist, other-artist]
  stage: mainstage
  start: 2026-12-11T23:30
  end: 2026-12-12T01:00
```

- `artists`: one or more artist ids. Each id must have a file in `data/artists/`. A B2B set has more than one id.
- `stage`: a stage id from `data/stages.yml`.
- `start` and `end`: the local festival time in the form `YYYY-MM-DDTHH:MM`.
- A set after midnight stays in the file of the festival day. Its `start` date is the next calendar day.

> [!WARNING]
> The import from Tomorrowland writes the set files again. Your change to a set file goes away at the next import.
> Change a set file only when the Tomorrowland timetable is wrong or late. Write the source of your change in the PR description.
