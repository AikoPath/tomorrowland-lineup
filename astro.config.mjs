// @ts-check
import { defineConfig } from 'astro/config';
import { loadLineup } from './src/data/load.ts';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  integrations: [
    {
      // Stop the build on data problems, also when no page reads the data yet.
      name: 'validate-lineup-data',
      hooks: {
        'astro:build:start': async () => {
          await loadLineup();
        },
      },
    },
  ],
});
