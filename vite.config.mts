import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Connect, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { cloudflareBeacon } from './scripts/beacon.mjs';

type Fetch = (request: Request) => Response | Promise<Response>;

const serveWorker = (load: () => Promise<Fetch>): Connect.NextHandleFunction => async (req, res, next) => {
  const path = req.url;
  if (!path || !/^\/(feed\.ics|today\.svg)(\?|$)/.test(path)) return next();
  try {
    const response = await (await load())(new Request(new URL(path, 'http://localhost')));
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(await response.text());
  } catch (error) {
    // For example, preview without a build: dist-worker/worker.js is missing
    next(error);
  }
};

// Answers /feed.ics and /today.svg locally with the same code Cloudflare runs:
// the source in development, the built Worker bundle in preview (which the e2e tests use)
const worker = (): Plugin => ({
  name: 'solar-calendar-worker',
  configureServer(server) {
    server.middlewares.use(serveWorker(async () => (await server.ssrLoadModule('/src/worker.ts')).default.fetch));
  },
  configurePreviewServer(server) {
    server.middlewares.use(serveWorker(async () => (await import(pathToFileURL(resolve('dist-worker/worker.js')).href)).default.fetch));
  },
});

export default defineConfig({
  // Relative asset URLs, so the build works from any path (previews, sub-folders)
  base: './',
  // The calendar, and the privacy, terms and disclaimer pages
  build: {
    // Every browser the app supports has modulepreload, so skip the polyfill's chunk
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { main: 'index.html', privacy: 'privacy.html', terms: 'terms.html', disclaimer: 'disclaimer.html' },
    },
  },
  plugins: [
    worker(),
    // Cloudflare Web Analytics, on a deploy build only (see scripts/beacon.mts)
    cloudflareBeacon(),
    // Works offline after the first visit: precaches the app, every name pack,
    // the moon library and the Latin-script fonts
    VitePWA({
      registerType: 'autoUpdate',
      // An external, deferred registerSW.js: the Content-Security-Policy needs no
      // inline script, and it doesn't hold up the first paint
      injectRegister: 'script-defer',
      manifest: {
        name: 'Solar calendar',
        short_name: 'Solar calendar',
        description: 'A calendar of 13 identical 28-day months, with the year starting at the spring equinox.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f7f9',
        theme_color: '#1d2742',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // social.png is only for link previews
        globIgnores: ['**/*cyrillic*', '**/*vietnamese*', '**/social.png'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/feed\.ics/, /\/today\.svg/],
        // Take control of the page that installed it, so the first visit already works offline
        clientsClaim: true,
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
