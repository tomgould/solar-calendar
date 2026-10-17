import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

type Fetch = (request: Request) => Response | Promise<Response>;

const serveFeed = (load: () => Promise<Fetch>): Connect.NextHandleFunction => async (req, res, next) => {
  if (!req.url?.startsWith('/feed.ics')) return next();
  const response = await (await load())(new Request(new URL(req.url, 'http://localhost')));
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
};

// Answers /feed.ics locally with the same code Cloudflare runs: the source in
// development, the built Worker bundle in preview (which the e2e tests use)
const feed = (): Plugin => ({
  name: 'solar-calendar-feed',
  configureServer(server) {
    server.middlewares.use(serveFeed(async () => (await server.ssrLoadModule('/src/worker.ts')).default.fetch));
  },
  configurePreviewServer(server) {
    server.middlewares.use(serveFeed(async () => (await import(pathToFileURL(resolve('dist-worker/worker.js')).href)).default.fetch));
  },
});

export default defineConfig({
  // Relative asset URLs, so the build works from any path (previews, sub-folders)
  base: './',
  plugins: [feed()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
