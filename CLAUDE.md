# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A web app for a 13-month solar calendar: 13 identical 28-day months, with the year starting on the first Monday on or after the March equinox, and Gregorian dates alongside. It's a static TypeScript and Vite site, to be hosted on Cloudflare. `docs/redesign.md` holds the review of the original app, every decision taken, and the phased plan with its status. Read it before planning changes.

## Commands

```bash
npm run dev            # Vite dev server, http://localhost:5173
npm run build          # static site in dist/ (relative asset paths, base './')
npm run deploy         # build, then wrangler deploy to Cloudflare (npx wrangler login once first)
npm run typecheck      # tsc for src, then tsc -p tests (tests get Node types)
npm test               # test:unit then test:e2e
npx vitest run tests/unit/core.test.ts              # one unit test file
npx playwright test --project=chromium -g "leap"    # one e2e test, one project
```

- The e2e tests start their own server (`webServer` in `playwright.config.ts`: build, then `vite preview` on port 4173).
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
  - `DEFAULT_PACK_ID` in `registry.ts` is `original`.
- **`src/sky/moon.ts`** dynamically imports astronomy-engine, so its 43 KB gzipped stays out of the main bundle. Quarter names appear only on the day the quarter happens, matching the grid marks.
- **`src/ui/`:**
  - `MonthView` builds its 28 cells once and only updates labels, marks and the month colour when the month changes.
  - `YearView` is a 28-row by 13-column table (14 columns in a leap-week year). It shrinks long month names to fit rather than breaking them, and re-measures after web fonts load.
  - `main.ts` holds state (selected day number, view, pack) and keeps the URL in step (`?date=YYYY-MM-DD&names=…&view=year`).
- **Styles** live in `src/styles/app.css`.
  - Tokens sit on `:root`, and the dark theme is redefined under `prefers-color-scheme` (guarded by `:not([data-theme='light'])`) and under `[data-theme='dark']`.
  - Month colours come from the `.hue-1` to `.hue-14` classes in `app.css`, applied with `hueClass()`: 13 OKLCH hues at equal lightness and chroma, plus grey for the leap week. Text is never set in a month hue.
  - The typefaces are self-hosted through Fontsource: Big Shoulders (variable, with an optical-size axis) for numerals and month names, and Andika for everything else. Big Shoulders lacks `ǣ`, so pack `name` fields use `Æ` and put the full spelling in `original`.
- **No inline scripts or `style` attributes.** `public/_headers` sends a strict Content-Security-Policy (`script-src 'self'; style-src 'self'`), and an e2e test runs the app under it. Set styles through classes or the CSSOM (`element.style`), never `style="…"` in HTML strings. The theme is applied before first paint by `public/theme.js`, a plain file Vite copies as-is.
- **Hosting:** Cloudflare Workers with static assets (`wrangler.jsonc` serves `dist/`). Everything in `public/` (`_headers`, `theme.js`, `favicon.svg`) is copied to `dist/` unchanged. `.github/workflows/ci.yml` runs the type check, unit tests and e2e tests on every push and pull request.
- **History:** changing view, year or month pushes a history entry; days within a month replace it. The `popstate` handler re-reads the URL.
