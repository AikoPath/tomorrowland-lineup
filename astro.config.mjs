// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import { loadLineup } from './src/data/load.ts';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  env: {
    schema: {
      // The browser uses these values to sign in. Without them, the site has no sign-in. See supabase/README.md.
      PUBLIC_SUPABASE_URL: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },
  fonts: [
    {
      // Tomorrowland uses Europa, an Adobe font with a license. Figtree is a free font with a similar shape.
      provider: fontProviders.fontsource(),
      name: 'Figtree',
      cssVariable: '--font-body',
      weights: [400, 700],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
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
