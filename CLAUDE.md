# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-build web app showing a 13-month x 28-day "Solar" calendar next to the Gregorian calendar, with links between the two. There is one PHP script, `RealTime.php`, which converts today's date.

**The README is out of date.** It describes a 12-month Persian Solar Hijri calendar (Farvardin, Ordibehesht, and so on). The code implements a different calendar, described under "Calendar model" below. Trust the code and the docblock at the top of `calendar-processor.js`, not the README.

## Redesign in progress (`redesign` branch)

A rewrite is under way. `docs/redesign.md` holds the review, the decisions and the phased plan; read it before changing anything. The new app lives alongside the old pages until phase 5 removes them:

- `index.html` and `src/` are a TypeScript and Vite app. `npm run dev` serves it, and `npm run build` writes `dist/`. `npm run typecheck` runs `tsc`, and `npm run test:unit` runs Vitest on `tests/unit/`. For a single test file, use `npx vitest run tests/unit/core.test.ts`.
- `src/core/` is pure date logic using integer day numbers (`days.ts`), never `Date` arithmetic. `astro.ts` computes equinoxes and solstices with Meeus chapter 27, and `solar.ts` holds the calendar rules: years start on the first Monday on or after the March equinox (UTC date), 13 x 28 days, and month 14 is a 7-day leap week in 371-day years. The unit tests check it against astronomy-engine and round-trip every day from 1600 to 2400.
- `src/names/packs/*.json` are month-name packs, found automatically by `import.meta.glob` and checked by `src/names/schema.ts`. To add a pack, add a file; the file name must equal its `id`.
- `src/sky/moon.ts` lazy-loads astronomy-engine for moon phases only, so it stays out of the main bundle.
- The month view builds its 28 cells once and only updates the labels. The year view is a 28-row by 13-column table.

Everything below describes the old pages.

## Commands

No build step. Open the HTML pages through a web server, not `file://`. Over `file://` the browser blocks `fetch()` of the equinox JSON, and `CalendarProcessor` quietly switches to approximate fallback dates, so pages look fine but show the wrong data.

```bash
npm install && npx playwright install       # first time; node_modules is not committed
npm test                                    # all e2e tests, chromium + firefox + webkit
npx playwright test --project=chromium      # one browser
npx playwright test tests/e2e/calendar.spec.js -g "gregorian calendar page"   # one test
npm run test:ui | test:headed | test:report
```

The tests run against `baseURL: http://solar-calendar.local` (see `playwright.config.js`). There is no `webServer` entry, so something outside the repo has to serve the repo root at that host, with PHP enabled for the `/RealTime.php` test. The repo does not set that host up. `php -S 127.0.0.1:8000` serves the repo well enough for the tests, but because `baseURL` is hard-coded you need a config that overrides `use.baseURL` to point at it.

## Architecture

- `calendar-processor.js` holds the `CalendarProcessor` class with all the date logic. Both HTML pages load it with a `<script>` tag, plus `calendar-styles.css`.
- `solar-calendar.html` and `gregorian-calendar.html` each have a large inline script for rendering, navigation, theme and URL handling. The two scripts are near copies (`toggleTheme`, `initializeTheme`, `navigateYear`, `updateYear`, the date highlight on load). A change to one page usually needs the same change in the other.
- Startup on both pages: `await loadVernalEquinoxData()` (fetches `spring_equinox_dates_0001_to_2100.json`, keeps years 1899 to 2101, pre-caches year start dates), then `handleURLParameters()`, then `generateCalendar()`. Every month grid is rendered up front and `updateDisplay()` toggles `.month.active`.
- Pages link to each other with query parameters: `?date=YYYY-MM-DD` (always a Gregorian date, on both pages), `?year=`, and `?month=` (0 to 12 on the solar page, 0 to 11 on the Gregorian page). Clicking a day or an astronomical event card goes to the other page with `date` and `year` set.
- Dates are handled as UTC midnight `Date` objects (`Date.UTC`, `getUTC*`, `toISODateString`). Keep to that, because local-time methods shift days in some time zones. Day cells carry `data-gregorian-date`, which the highlight-on-load code queries.
- Theme is `data-theme` on `<html>`, saved in `localStorage.theme`. Colours are CSS custom properties in `calendar-styles.css`.
- `RealTime.php` is a separate port of the same conversion. It reads the same JSON and prints `print_r` output for today's date. It does not match the JS for the extra days: it labels both the equinox date and days past 364 as "Equinox Day", while the JS uses "Year Day" and "Leap Day".

## Calendar model

- 13 months of 28 days, so each month is exactly four Monday-to-Sunday weeks. The months are named March to February, then "Sol" (`calendarStructure`, `startDay` 1, 29, ..., 337).
- A solar year N starts on the first Monday on or after the vernal equinox of Gregorian year N (`getSolarYearStartDate`).
- Day 365 is "Year Day" and day 366 is "Leap Day", outside the months. `isSolarLeapYear` calls a year leap when the next year's start is 366 days away.
- Supported years are 1900 to 2100. The JSON covers years 1 to 2100.
- Astronomical events: the vernal equinox comes from the JSON. The solstices and the autumn equinox are fixed dates (21 Jun, 22 Sep, 21 Dec).

## Known issues (checked with node against the real data)

- Because every year starts on a Monday, the gap between two year starts is always a multiple of 7. Over 1900 to 2100 it is 364 days 165 times and 371 days 35 times, and never 366. So `isSolarLeapYear` never returns true, and the Year Day / Leap Day idea does not fit the start rule. In a 364-day year, "Year Day" falls on day 1 of the next year.
- In a 371-day year, the six days between Year Day and the next year's start have no solar date, so `getSolarDateFromGregorian` returns `null` for them (for example 2029-03-20 to 2029-03-25). It used to recurse forever on these days and crash the Gregorian page. The tests in `371-day years` guard against that.
- The test suite only checks that pages load and that `RealTime.php` responds. It does not test any conversion logic.
