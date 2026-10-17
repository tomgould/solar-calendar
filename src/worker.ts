import { utcDayOfInstant } from './core/days';
import { MAX_YEAR, MIN_YEAR, solarYearOf, yearStart } from './core/solar';
import { buildIcs } from './feed/ics';
import { holidaySets } from './holidays/registry';
import type { FestivalSource } from './names/festivals';
import { DEFAULT_PACK_ID } from './names/registry';
import { type NamePack, validatePack } from './names/schema';

/**
 * The Cloudflare Worker behind /feed.ics: a subscribable calendar covering
 * last solar year to next, in the requested name pack, with any other packs'
 * festivals (?festivals=persian,roman) and bank holidays (?holidays=uk-scotland,uk-northern-ireland)
 * asked for. Everything else on
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
  // Unknown ids are skipped, as are repeats and the names' own pack
  const extraIds = new Set((url.searchParams.get('festivals') ?? '').split(','));
  const extra: FestivalSource[] = [...packs.values()].filter((other) => extraIds.has(other.id) && other.id !== pack.id);
  extra.push(...holidaySets(url.searchParams.get('holidays')));
  const body = buildIcs({ pack, extra, from: yearStart(year - 1), to: yearStart(year + 2) - 1, now });
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
