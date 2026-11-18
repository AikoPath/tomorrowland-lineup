// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import { PHOTO_PROXIES } from './src/artist/photo.ts';
import { loadLineup } from './src/data/load.ts';
import { writeServiceWorker } from './src/pwa/service-worker.ts';

/** @type {URL} */
let root;

/** The same photo paths as the rewrites in vercel.json, for `astro dev` and `astro preview`. */
const photoProxy = Object.fromEntries(
  PHOTO_PROXIES.map(({ path, origin }) => [
    path,
    { target: origin, changeOrigin: true, rewrite: (/** @type {string} */ url) => url.slice(path.length) },
  ]),
);

// https://astro.build/config
export default defineConfig({
  output: 'static',
  vite: {
    server: { proxy: photoProxy },
    preview: { proxy: photoProxy },
  },
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
    {
      name: 'service-worker',
      hooks: {
        'astro:config:done': ({ config }) => {
          root = config.root;
        },
        'astro:build:done': async ({ dir }) => {
          await writeServiceWorker(dir, root);
        },
      },
    },
  ],
});
