# Tomorrowland Thailand 2026 lineup

This site makes the Tomorrowland Thailand 2026 timetable easier to explore. It shows each artist with genres, social links and music previews.

The site is static. [Astro](https://astro.build) reads the YAML data files at build time and writes HTML files. The site has no backend and no database.

To add or correct artist and timetable data, read [CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

- Node.js 22.23.4 or later
- npm

## Commands

Run each command from the root of the repo.

| Command                 | Result                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| `npm install`           | Installs the dependencies.                                                      |
| `npm run dev`           | Starts the development server at `http://localhost:4321`.                       |
| `npm run build`         | Writes the static site to `dist/`.                                              |
| `npm run preview`       | Serves `dist/` on your computer before you deploy it.                           |
| `npm test`              | Runs the tests.                                                                 |
| `npm run import:lineup` | Imports the Tomorrowland Thailand 2026 lineup into `data/`. See data/README.md. |

## Deploy

A static host can serve the `dist/` directory. The host does not need a server runtime.

## Project structure

```text
data/            The lineup data in YAML. See data/README.md.
public/          Files that Astro copies to dist/ with no change
scripts/         The import of the Tomorrowland Thailand 2026 lineup
src/artist/      The data of the artist page
src/artist-list/ The artist list and its filter
src/components/  The parts of the pages
src/data/        The schema and the loader of the lineup data
src/layouts/     The page layout that all pages use
src/pages/       One .astro file for each page of the site
src/site.ts      The name of the site
src/styles/      theme.css with the colors of the site as CSS variables
src/timetable/   The calculation of the timetable grid
```
