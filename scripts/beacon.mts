import type { Plugin } from 'vite';

// The Cloudflare Web Analytics site token. It is public by design: every visitor's
// browser receives it
const SITE_TOKEN = '717799c0f58d40e388c19030b5f25a1e';

type Env = Record<string, string | undefined>;

// The token to build into the pages, or '' for none. Only a deploy gets one:
// `npm run deploy` sets CF_BEACON_TOKEN, and Workers Builds (WORKERS_CI=1) gets
// the site token when it builds main. The dev server, `vite preview`, the tests
// and branch previews build without it, so they are never counted
export const beaconToken = (env: Env): string => {
  if (env.CF_BEACON_TOKEN) return env.CF_BEACON_TOKEN;
  return env.WORKERS_CI === '1' && env.WORKERS_CI_BRANCH === 'main' ? SITE_TOKEN : '';
};

export const beaconSnippet = (token: string): string =>
  `<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${token}"}'></script><!-- End Cloudflare Web Analytics -->`;

// Adds the beacon before </body> on every built page (the calendar and the legal pages)
export const cloudflareBeacon = (env: Env = process.env): Plugin => ({
  name: 'solar-calendar-beacon',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html) => {
      const token = beaconToken(env);
      return token ? html.replace('</body>', `${beaconSnippet(token)}\n</body>`) : html;
    },
  },
});
