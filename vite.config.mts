import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Connect, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { cloudflareBeacon } from './scripts/beacon.mjs';
import { sitemap } from './scripts/sitemap.mjs';
import { themeScript } from './scripts/theme.mjs';

type Fetch = (request: Request) => Response | Promise<Response>;

// The calendar, and the privacy, terms and disclaimer pages
const pages = { main: 'index.html', privacy: 'privacy.html', terms: 'terms.html', disclaimer: 'disclaimer.html' };

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
  build: {
    // Every browser the app supports has modulepreload, so skip the polyfill's chunk
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: pages,
    },
  },
  plugins: [
    worker(),
    // The theme script, inline in every page, and its hash in the built _headers
    themeScript(),
    // Cloudflare Web Analytics, on a deploy build only (see scripts/beacon.mts)
    cloudflareBeacon(),
    // sitemap.xml, listing every page at its canonical address (see scripts/sitemap.mts)
    sitemap(Object.values(pages)),
    // Works offline after the first visit: precaches the app, every name pack,
    // the moon library and the Latin-script fonts
    VitePWA({
      registerType: 'autoUpdate',
      // An external, deferred registerSW.js: the Content-Security-Policy needs no
      // inline script, and it doesn't hold up the first paint
      injectRegister: 'script-defer',
      manifest: {
        name: 'Solar Calendar',
        short_name: 'Solar Calendar',
        description: 'A calendar of 13 identical 28-day months, with the year starting at the spring equinox.',
        start_url: './',
        scope: './',
        display: 'standalone',
        // The design kit's paper
        background_color: '#fbf7f0',
        theme_color: '#fbf7f0',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // social.png is only for link previews. Of the design kit in kit/, the
        // pages use only the theme switch script: its stylesheets and fonts are
        // bundled into assets/, and the bundle never uses its Libre Caslon
        // Display or Schibsted Grotesk italic
        globIgnores: ['**/*cyrillic*', '**/*vietnamese*', '**/social.png', 'kit/css/**', 'kit/fonts/**', 'kit/images/**', '**/libre-caslon-display-*', '**/schibsted-grotesk-latin-wght-italic-*'],
        navigateFallback: 'index.html',
        // Files that aren't pages: open them in the browser and they still come from the server
        navigateFallbackDenylist: [/\/feed\.ics/, /\/today\.svg/, /\/robots\.txt/, /\/sitemap\.xml/],
        // Take control of the page that installed it, so the first visit already works offline
        clientsClaim: true,
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
