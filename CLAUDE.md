# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A web app for a 13-month solar calendar: 13 identical 28-day months, with the year starting on the first Monday on or after the March equinox, and Gregorian dates alongside. It's a static TypeScript and Vite site, to be hosted on Cloudflare. `docs/redesign.md` holds the review of the original app, every decision taken, and the phased plan with its status. Read it before planning changes.

## Commands

```bash
npm run dev            # Vite dev server, http://localhost:5173
npm run build          # static site in dist/ (relative asset paths, base './'), then the feed Worker in dist-worker/
npm run deploy         # build, then wrangler deploy to Cloudflare (npx wrangler login once first)
npm run typecheck      # tsc for src, then tsc -p tests (tests get Node types)
npm test               # test:unit then test:e2e
npx vitest run tests/unit/core.test.ts              # one unit test file
npx playwright test --project=chromium -g "leap"    # one e2e test, one project
```

- The e2e tests always build and start their own server (`webServer` in `playwright.config.ts`: build, then `vite preview` on port 4173). They never reuse a running server, because a leftover one serves stale files.
- Port 4173 must be free when the e2e tests run.
- The e2e projects are Chromium, Firefox, WebKit and a phone, all in London time, plus Chromium in New York, Tokyo and Kiritimati. The time-zone projects guard against the original app's off-by-one-day bug.

## Architecture

- **`src/core/` is pure logic with no DOM.**
  - All calendar arithmetic uses integer day numbers (days since 1970-01-01, `days.ts`, Hinnant's algorithms). Never do date maths with `Date` objects; they only read "now" and format times.
  - `astro.ts` computes equinox and solstice instants with Meeus chapter 27 and Espenak-Meeus delta-T.
  - `solar.ts` holds the calendar rules. Month 14 (`LEAP_WEEK`) is a 7-day leap week that exists only in 371-day years. `fromSolar` throws on dates that don't exist.
  - `sky.ts` turns instants into events on the viewer's local date.
- **Two kinds of date:** the calendar itself uses the equinox's UTC date, so it is the same everywhere. Sky events are shown on the viewer's local date. The tests check both.
- **`src/names/` is the month-name plugin system.**
  - Every `packs/*.json` file is picked up by `import.meta.glob`, lazy-loaded as its own chunk, and checked by `schema.ts`. The file name must equal the `id`, and files starting with `_` are skipped.
  - The core only knows month numbers; names come from packs in the UI.
  - Pack ids appear in URLs (`?names=`), so never rename one.
  - `DEFAULT_PACK_ID` in `registry.ts` is `gregorian`.
  - There are 12 packs, each with a `kind` (`historical` or `modern`) that groups the names menu. Add new ones from `_template.json`, following `docs/name-packs.md`. `tests/unit/fonts.test.ts` reads the real font files and fails if a pack uses a letter the fonts lack: Big Shoulders for `name`, Andika for other text. `original` is exempt, because it may be in another script.
- **Festivals:** a pack's optional `festivals` each have a date rule (`src/core/festivals.ts`): an equinox or solstice, a Gregorian `MM-DD` with an optional weekday, a solar date, Easter, a one-off date, or a Julian, Coptic or Persian date (`src/core/calendars.ts`), with optional `before` (weekday), `offset` and `days`. Festivals can also have `from`, `until` and `moves`.
  - `src/names/festivals.ts` turns any `FestivalSource` (a pack or a holiday set) into `FestivalDay`s, including substitute days off.
  - The festivals shown come from the chosen names, any other packs ticked in the Festivals menu (`localStorage.festivals`, a comma list; unset means every pack, `""` none), and any of the bank holiday sets (`localStorage.holidays`, a comma list; `""` is none, and unset means all of them). `festivalsFrom` shows a holiday that several sets share on the same day once, with every set in `regions`.
  - They show as a star (or a flag for a day off) in the grid, a dot in the year table, in the day panel, the list under the month, the table under the year, the meaning dialog (with the next date) and the ICS feed (`&festivals=…&holidays=…`).
- **Bank holidays:** `src/holidays/*.json`, one per UK region, bundled with the app. `tests/unit/holidays.test.ts` checks them against GOV.UK's list in `tests/fixtures/`. `npm run holidays:check` refreshes that list, and `.github/workflows/holidays.yml` does so weekly and opens a pull request when it changes. Its first job runs the project's code with read-only access; only the second, which runs nothing from the project, can write. It needs the repository setting "Allow GitHub Actions to create and approve pull requests".
- **"Hear it":** `src/ui/speech.ts` uses the browser's speech synthesis. A voice for the name's language reads it (Persian from the `original` script); otherwise an English voice reads the `say` respelling. Romanised tags such as `fa-Latn` never get a native voice. Buttons appear only where `say` exists and the browser can speak.
- **`src/sky/moon.ts`** dynamically imports astronomy-engine, so its 43 KB gzipped stays out of the main bundle. Quarter names appear only on the day the quarter happens, matching the grid marks.
- **`src/ui/`:**
  - `MonthView` builds its 28 cells once and only updates labels, marks and the month colour when the month changes.
  - `YearView` is a 28-row by 13-column table (14 columns in a leap-week year). It shrinks long month names to fit rather than breaking them, and re-measures after web fonts load.
  - On screens narrower than 980px the day panel is a sheet fixed to the bottom; its Details button (`aria-expanded`) opens the rest, and Escape or tabbing away closes it.
  - `<main>` starts with `is-loading` (hidden) and `start()` removes it after the first render, so the page doesn't shift as it fills in. The first render doesn't wait for the other packs' festivals; they load alongside the chosen names and a second render adds them.
  - `main.ts` holds state (selected day number, view, pack) and keeps the URL in step (`?date=YYYY-MM-DD&names=…&view=year`).
- **Styles** live in `src/styles/app.css`.
  - Tokens sit on `:root`, and the dark theme is redefined under `prefers-color-scheme` (guarded by `:not([data-theme='light'])`) and under `[data-theme='dark']`.
  - Month colours come from the `.hue-1` to `.hue-14` classes in `app.css`, applied with `hueClass()`: 13 OKLCH hues at equal lightness and chroma, plus grey for the leap week. Text is never set in a month hue.
  - The typefaces are self-hosted through Fontsource: Big Shoulders (variable, with an optical-size axis) for numerals and month names, and Andika for everything else. Big Shoulders lacks `ǣ`, so pack `name` fields use `Æ` and put the full spelling in `original`.
- **No inline scripts or `style` attributes.** `public/_headers` sends a strict Content-Security-Policy (`script-src 'self'; style-src 'self'`, plus Cloudflare Web Analytics' beacon host), and an e2e test runs the app under it. Set styles through classes or the CSSOM (`element.style`), never `style="…"` in HTML strings. The theme is applied before first paint by `public/theme.js`, a plain file Vite copies as-is.
- **Hosting:** Cloudflare Workers with static assets (`wrangler.jsonc` serves `dist/`). Everything in `public/` (`_headers`, `theme.js`, `favicon.svg`) is copied to `dist/` unchanged. `.github/workflows/ci.yml` runs the type check, unit tests and e2e tests on every push and pull request.
  - Live at https://solar.dealmobile.co.uk, a custom domain set up in the Cloudflare dashboard rather than in `wrangler.jsonc`. https://solar-calendar.solar-calendar.workers.dev still works and must stay on, because calendar subscriptions use its feed URL. Workers Builds (connected in the Cloudflare dashboard) deploys `main` on every merge, and builds a preview of other branches with `wrangler preview`, which needs the empty `previews` block in `wrangler.jsonc`.
  - `observability` in `wrangler.jsonc` keeps the feed Worker's logs in the dashboard.
  - Cloudflare Web Analytics (no cookies) is turned on for the domain in the dashboard, which adds its beacon to the page; the CSP allows `static.cloudflareinsights.com` and `cloudflareinsights.com` for it.
  - `index.html` has Open Graph tags for link previews. Their image, `public/social.png`, was rendered once from `scripts/social-image.html` (the command is in that file).
  - Dependabot (`.github/dependabot.yml`) opens weekly pull requests for npm packages and GitHub Actions. The workflows pin actions to commit SHAs with a version comment, and Dependabot updates both.
  - GitHub Pages is switched off for the repo; the old app used it.
- **History:** changing view, year or month pushes a history entry; days within a month replace it. The `popstate` handler re-reads the URL.
- **Calendar feed:** `src/feed/ics.ts` builds RFC 5545 text (CRLF, 75-octet folding, escaping), and the unit tests parse it with ical.js.
  - `src/worker.ts` serves `/feed.ics` and `/today.svg` (a badge with today's solar date, `src/feed/badge.ts`, in UTC or `?tz=`) and bundles every pack with an eager `import.meta.glob`. It is built by `vite.worker.config.mts`, because wrangler's bundler can't do the glob.
  - `wrangler.jsonc` routes only those two paths to it (`run_worker_first`).
  - The dev server (source) and the preview server (built bundle) both answer them through a plugin in `vite.config.mts`, so the e2e tests cover the real Worker.
- **Sun:** `src/sky/sun.ts` uses astronomy-engine's `SearchRiseSet` for the place's own day, in the place's time zone from `@photostructure/tz-lookup` (lazy-loaded), and handles polar day and night. The place lives in `localStorage.location`, either from geolocation rounded to 2 decimals or typed in. On a first visit, `#location-notice` explains why and offers "Use my location" (the only thing that triggers the browser's permission prompt) or "No thanks"; declining, a blocked prompt or forgetting the place sets `localStorage.locationPrompt` to `declined`, so it isn't shown again. `_headers` allows `geolocation=(self)`.
- **Lazy loads:** every lazy load (packs, the moon, the sun) has a `.catch` that shows a message, so a failed import never surfaces as an unhandled rejection.
- **Offline:** `vite-plugin-pwa` precaches the app, all packs, astronomy-engine and the Latin-script fonts.
  - It uses `clientsClaim`, so the first visit already works offline.
  - Registration is the external, deferred `registerSW.js`, so the CSP holds and it doesn't block the first paint.
  - The PWA icons in `public/icons/` were rendered once from the favicon design.
  - The CSP e2e test blocks service workers. Otherwise they answer requests before `page.route` can add the policy.
- **Converter:** `src/ui/goto.ts` shows the selected day in both forms. It only skips the field being typed in.
- **Printing:** prints whichever view is on screen, on one A4 landscape page. The print block in `app.css` forces light tokens using a selector that matches the dark rules' specificity. The e2e test generates a PDF in Chromium and checks that it has exactly one page; if you change month or year layout, keep that test passing.
