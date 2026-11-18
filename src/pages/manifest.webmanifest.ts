import type { APIRoute } from 'astro';
import { BACKGROUND_COLOR, SITE_NAME, SITE_SHORT_NAME } from '../site.ts';
import { LINEUP_URL } from '../urls.ts';

/** With this manifest, a phone can install the site as an app on the home screen. */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: SITE_NAME,
      short_name: SITE_SHORT_NAME,
      start_url: LINEUP_URL,
      scope: '/',
      display: 'standalone',
      background_color: BACKGROUND_COLOR,
      theme_color: BACKGROUND_COLOR,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
