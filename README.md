# Solar calendar

A calendar of 13 identical months. Every month has 28 days, exactly four weeks, so the 1st is always a Monday and the 28th is always a Sunday. The year starts on the first Monday on or after the March equinox, so it stays with the seasons. Gregorian dates are shown alongside every day.

## How the calendar works

- **13 x 28 = 364 days.** Usually the next year starts 364 days later. About one year in six it starts 371 days later, and the extra seven days form a leap week at the end of the year.
- **The equinox is calculated, not looked up.** It uses Jean Meeus's algorithm (*Astronomical Algorithms*, chapter 27), accurate to about a minute. The start of the year uses the equinox's date in UTC, so the calendar is the same everywhere.
- **Solar year 2026** runs from Monday 23 March 2026 to Sunday 21 March 2027. Solar 2028 ends with a leap week, 19 to 25 March 2029.

## What it does

- Opens on today, with the date in both calendars.
- Month view: the numbers 1 to 28 never move, and only the Gregorian dates change from month to month. Equinoxes, solstices, and new and full moons are marked.
- Day details: day of the year, moon phase, and the next equinox or solstice in your local time.
- Year view: every day of the year in one table, one row per day of the month.
- Printing: a month or the whole year, each on a single A4 page, in light colours whatever the screen theme.
- Month name packs: switch between sets of month names, such as the Gregorian names or the Anglo-Saxon months recorded by Bede, and read what each name means.
- Dark mode, keyboard navigation and phone layouts.

## Development

```bash
npm install
npx playwright install   # browsers for the end-to-end tests
npm run dev              # http://localhost:5173
npm test                 # unit tests, then end-to-end tests
npm run typecheck
npm run build            # static site in dist/
```

Run one test file with `npx vitest run tests/unit/core.test.ts` or `npx playwright test --project=chromium`.

## Deployment

The site runs on Cloudflare Workers as static files (`wrangler.jsonc`).
- **Deploying:** log in once with `npx wrangler login`, then `npm run deploy` builds and deploys.
- **Security headers:** `public/_headers` sets them, including a strict Content-Security-Policy, so the app uses no inline scripts or styles.
- **CI:** GitHub Actions runs the type check and all tests on every push and pull request.

## Adding a month name pack

Add one JSON file to `src/names/packs/`. The app finds it automatically, and the file name must match the pack's `id`. `src/names/schema.ts` describes the format, and `npm run test:unit` checks every pack. Give each meaning a source, and mark disputed meanings as uncertain.

## Project layout

- `src/core/`: date logic with no DOM. It uses integer day numbers (`days.ts`), equinoxes and solstices (`astro.ts`) and the calendar rules (`solar.ts`).
- `src/names/`: the name pack format, its loader, and the packs.
- `src/sky/`: moon phases, using astronomy-engine, which loads only when needed.
- `src/ui/`: the month view, year view, day panel and name pack menus.
- `tests/unit/` and `tests/e2e/`: Vitest and Playwright.
- `docs/redesign.md`: the review of the original app, the decisions behind this version, and the plan.

## Licence

GNU GPL v3. See [LICENSE](LICENSE).
