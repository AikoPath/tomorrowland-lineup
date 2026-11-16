# Tomorrowland lineup

This site makes the Tomorrowland timetable easier to explore. It shows each artist with genres, social links and music previews.

The site is static. [Astro](https://astro.build) reads the YAML data files at build time and writes HTML files. The site has no backend and no database.

## Requirements

- Node.js 22.23.4 or later
- npm

## Commands

Run each command from the root of the repo.

| Command           | Result                                                    |
| ----------------- | --------------------------------------------------------- |
| `npm install`     | Installs the dependencies.                                |
| `npm run dev`     | Starts the development server at `http://localhost:4321`. |
| `npm run build`   | Writes the static site to `dist/`.                        |
| `npm run preview` | Serves `dist/` on your computer before you deploy it.     |
| `npm test`        | Runs the tests.                                           |

## Deploy

A static host can serve the `dist/` directory. The host does not need a server runtime.

## Project structure

```text
data/         The lineup data in YAML. See data/README.md.
public/       Files that Astro copies to dist/ with no change
src/data/     The schema and the loader of the lineup data
src/pages/    One .astro file for each page of the site
```
