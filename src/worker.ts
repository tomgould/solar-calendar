import { utcDayOfInstant } from './core/days';
import { MAX_YEAR, MIN_YEAR, solarYearOf, yearStart } from './core/solar';
import { buildIcs } from './feed/ics';
import { DEFAULT_PACK_ID } from './names/registry';
import { type NamePack, validatePack } from './names/schema';

/**
 * The Cloudflare Worker behind /feed.ics: a subscribable calendar covering
 * last solar year to next, in the requested name pack. Everything else on
 * the site is static files; wrangler.jsonc routes only /feed.ics here.
 */

// Bundled into the Worker, unlike the app, which loads packs on demand
const packs = new Map(
  Object.entries(import.meta.glob<unknown>('./names/packs/*.json', { eager: true, import: 'default' }))
    .filter(([path]) => !path.slice(path.lastIndexOf('/') + 1).startsWith('_'))
    .map(([path, data]) => {
      const pack: NamePack = validatePack(data, path);
      return [pack.id, pack];
    }),
);

export function feedResponse(url: URL, now = Date.now()): Response {
  const pack = packs.get(url.searchParams.get('names') ?? '') ?? packs.get(DEFAULT_PACK_ID)!;
  const year = Math.min(MAX_YEAR - 1, Math.max(MIN_YEAR + 1, solarYearOf(utcDayOfInstant(now))));
  const body = buildIcs({ pack, from: yearStart(year - 1), to: yearStart(year + 2) - 1, now });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="solar-calendar-${pack.id}.ics"`,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}

export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    if (url.pathname !== '/feed.ics') return new Response('Not found', { status: 404 });
    return feedResponse(url);
  },
};
