# Solar calendar redesign

## 1. Review of the current app (17 Oct 2026)

Evidence came from reading the code, screenshots at 1440px and 390px in light and dark, and a node check against Jean Meeus's equinox and solstice algorithm (*Astronomical Algorithms*, ch. 27). That algorithm matches published 2024 and 2025 times to within a minute.

### Accuracy

These matter most, because a calendar that is sometimes a day or a week out is worse than no calendar.

| Problem | Evidence | Effect |
|---|---|---|
| The year model doesn't add up | Every year starts on a Monday, so years are 364 or 371 days (165 and 35 times over 1900 to 2100), never 365 or 366 | Leap Day can never appear. "Year Day" lands on day 1 of the next year (the 2026 page says "Year Day: March 22", which is 1 March 2027). In 371-day years, six days have no solar date. Until today's fix they crashed the page. |
| Off by one day west of UTC | The Gregorian page builds UTC dates and the processor reads them back with local `getFullYear()`/`getDate()` | In New York, 23 Mar 2026 (solar New Year) shows as "Sol 28, 2025", and every cell is one day out |
| Equinox data is wrong in a third of years | The JSON disagrees with Meeus (UTC date) in 67 of 201 years, and is usually a day early | In 9 years (1905, 1911, 1922, 1933, 1939, 1950, 1967, 1995, 2085) the whole solar year starts a week out. Entries before 1600 are all placeholders ("03-21"). |
| Solstices and autumn equinox are fixed dates | Hard-coded as 21 Jun, 22 Sep and 21 Dec | Wrong date in 83, 115 and 97 of 201 years respectively |
| Silent fallback | If the JSON fetch fails (offline, or opened from `file://`), approximate dates are used with no warning | Wrong dates that look right |
| PHP port disagrees with the JS | `RealTime.php` calls both the equinox date and days past 364 "Equinox Day" | Two answers to the same question |
| History of the same class of bug | The PDFs repeat 30 Mar 2025 and skip 26 Oct 2025 (UK clock changes) | Date maths on `Date` objects keeps biting. Use plain day numbers. |

### Design and UX

- **Generic look.** A blue-to-purple gradient bar, identical rounded cards and emoji icons. Nothing in it says "sun" or "13 identical months".
- **Chrome before content.** The header, nav, "Year End Days" panel and four event cards push the calendar into the bottom half on desktop. At 390px it starts most of a screen down.
- **The main question is hard to answer.** "What's today's solar date?" has no direct answer. The solar page opens on month 1, not today's month.
- **The calendar's best feature is hidden.** Every month is identical (the 1st is always a Monday, the 28th always a Sunday), but nothing shows or explains that, and there's no year-at-a-glance view.
- **Confusing names.** Solar months reuse Gregorian names but are offset by about three weeks (solar October is 5 Oct to 1 Nov 2026).
- **Debug-style text.** "March / (1/13)", "Month(s) 7-8/13", and "SOLAR:" repeated in all 31 Gregorian cells. Month names truncate on mobile ("Septembe"), and there's an empty grey band where a sixth week row would be.
- **Dark mode flashes white on load and ignores the OS setting.**

### Accessibility (WCAG 2.2 AA)

- Day cells and event cards are clickable `div`s, so there's no keyboard access, no grid or table semantics, and no `aria-current` for today.
- Contrast fails in many places: secondary text 4.2 to 4.45:1, tertiary text 2.1 to 3.0:1, white on accent buttons 2.5 to 3.3:1, today's number 2.7 to 3.1:1, event titles 2.2 to 2.5:1, cell borders 1.3:1.
- The year input has no visible focus ring (the `rgba(var(--hex))` rule is invalid). Tooltips are hover-only, some labels are emoji-only, and `prefers-reduced-motion` is ignored.

### Code

- Two pages with about ten near-copied functions, globals, and inline `onclick`.
- CSS is duplicated between `calendar-styles.css` and inline `<style>` blocks, with no spacing or type scale.
- Date logic mixes UTC and local `Date` methods.
- Tests only check that pages load. No conversion logic is tested, and the e2e config points at a host that has to be set up by hand.
- **Performance** isn't a real problem at this size. Two thirds of the 163 KB payload is the equinox JSON, though, and every month is rendered up front and then hidden. The gains to chase are accuracy and payload, not render speed.

### Worth keeping

- The concept: 13 months of 28 days, Monday starts, the year anchored to the spring equinox, and Gregorian dates alongside.
- Linking between the two calendars, and dark mode.
- Print. The PDFs show a printed year was part of the original idea.

## 2. Decisions (17 Oct 2026)

| Topic | Decision |
|---|---|
| Year model | **Leap week.** Year N starts on the first Monday on or after the March equinox of year N, taking the equinox's date in UTC. Normal years are 13 x 28 = 364 days. A 371-day year ends with a 7-day leap week. That's 35 of the 200 years from 1900 to 2100, about 1 in 6. |
| Month names | **Switchable name packs.** All eleven sets in section 4 ship, including the original names. People pick a pack, can switch any time, and see what each month's name means. The default for new visitors is the Original names pack (confirmed 17 Oct 2026). |
| Design | **Perennial grid.** See section 3. |
| Extras | All four: print-ready year, ICS calendar feed, sun and moon data, offline PWA |
| Stack | TypeScript, Vite, no UI framework, static output (confirmed) |
| Equinox day | Taken in UTC (confirmed) |
| Hosting | Cloudflare, on your personal account (confirmed). Code stays on GitHub at `tomgould/solar-calendar`, with a small Worker for the ICS feed. See section 6. |
| The original app | Removed on 17 Oct 2026, ahead of phase 5 and at your request: the old pages, CSS, JS, equinox JSON, `RealTime.php`, PDFs and old tests. Git history keeps them. |

## 3. Design direction: perennial grid

**Subject:** a calendar whose 13 months are identical, anchored to the spring equinox. **Audience:** curious people and calendar enthusiasts, and anyone who prints a year or subscribes to a feed. **Primary job:** say what today is in the solar calendar, and map any day between the two calendars.

**The idea:** the grid never changes. Day 1 is always a Monday and day 28 always a Sunday, in every month of every year. The design makes that visible. The large numerals 1 to 28 stay where they are, and only the small Gregorian dates, the month name and the month colour change. The code follows the same idea: the month view builds its 28 cells once and only updates their text.

### Tokens (starting point, to be confirmed in the prototype)

- **Colour:**
  - Paper `#F6F7F9`, a cool off-white.
  - Ink `#1D2742`, a deep indigo printing-ink tone, used for text and today's cell.
  - Muted `#566079`, for Gregorian dates (must reach at least 4.5:1 on paper).
  - Rule `#CDD2DC`, for grid lines.
  - **Month hues:** 13 colours stepped evenly around an OKLCH wheel (360/13, about 27.7 degrees apart), all at the same lightness and chroma: 13 months around the sun. They're used for the month strip, the year view and a thin band on the active month. Text is never set in these hues, and colour is never the only cue.
  - Dark mode swaps paper and ink to a deep indigo night (`#161C2E`) and keeps the same hues, re-tuned for contrast.
- **Type:**
  - *Big Shoulders Display* for the numerals 1 to 28 and the month name. Being tall and condensed, it keeps the numerals large in a seven-column grid on a 390px phone, and it has a civic, wall-calendar feel.
  - *Andika* for everything else. The prototype replaced Atkinson Hyperlegible Next, which lacks `ō` and `ǣ`. Andika is SIL's legibility-first typeface and covers every letter in every pack. Big Shoulders lacks only `ǣ`, so display names use `Æ`, and the full spelling appears in Andika in the meaning panel.
  - Bodoni Moda numerals are the fallback option to try in the prototype.
  - The scale follows *The Elements of Typographic Style*, sentence case throughout.
- **Layout:** left-aligned, one column up to about 1040px wide, with the day panel beside the grid on desktop and as a bottom sheet on mobile. The calendar is the first thing below the one-line answer to "what's today?".

### Wireframes

Month names are from set B for illustration only.

```
Desktop, opens on today
Solar calendar                                  2026 < >   Today   Year
Today is Octava 13, 2026. Saturday 17 October 2026.

[ ][ ][ ][ ][ ][ ][ ][#][ ][ ][ ][ ][ ]   13 month swatches; also the month nav
<  Octava, month 8 of 13, 5 Oct to 1 Nov 2026  >

  Mon    Tue    Wed    Thu    Fri    Sat    Sun       | Octava 13, 2026
 +------+------+------+------+------+------+------+   | Saturday 17 October 2026
 |  1   |  2   |  3   |  4   |  5   |  6   |  7   |   | Day 209 of 364
 | 5 Oct|    6 |    7 |    8 |    9 |   10 |   11 |   | Sunrise, sunset (your location)
 +------+------+------+------+------+------+------+   | Moon: waxing crescent
 |  8   |  9   | 10   | 11   | 12   |##13##| 14   |   | Next: winter solstice,
 |   12 |   13 |   14 |   15 |   16 |##17##|   18 |   |   21 Dec 2026, 20:50 UTC
 +------+------+------+------+------+------+------+   | [Copy link] [Add to calendar]
 | 15 ...                               21   |
 | 22 ...                         28 / 1 Nov |
 +------+------+------+------+------+------+------+
```

- Gregorian labels show the month only on day 1 and wherever the Gregorian month changes ("1 Nov"). Elsewhere they show just the day number. That fixes the 31 repeated "SOLAR:" labels.
- Equinoxes, solstices and moon phases appear as small marks in their cells. Details go in the day panel, not in four cards above the grid.

```
Year view (screen and print, A4/Letter landscape)
Solar year 2026: 23 Mar 2026 to 21 Mar 2027, 364 days          [Print]
         Prima   Secunda  Tertia  ...  Tredecima  (Leap week)
 1 Mon   23 Mar  20 Apr   18 May  ...  22 Feb     (19 Mar)
 2 Tue   24      21       19      ...  23
 ...
28 Sun   19 Apr  17 May   14 Jun  ...  21 Mar
The prototype uses a "perennial table" instead of 13 mini grids: one row
per day of the month, one column per month. It only works because every
month is identical (row 1 is always a Monday), and it shows every
Gregorian date of the year at once. It prints well on one A4 landscape page.
```

### Check against generic defaults, and what changed

- No gradient bar, card kit or emoji icons: the old look was the SaaS-card default.
- Avoided cream paper, a high-contrast serif and a terracotta accent. Paper is cool, ink is indigo, and colour comes from the 13 month hues, which carry information.
- No all-caps eyebrow labels, middle-dot meta strings or monospace data labels.
- Numbering is used only where the content really is a sequence (days 1 to 28, month 8 of 13).
- Boldness goes in one place, the fixed numerals. Everything else stays quiet.
- One motion moment: when you change month, the numerals stay still while the Gregorian labels and the month hue cross-fade. That shows the perennial idea, and it's turned off under reduced motion.

## 4. Month name sets

All of these ship as switchable **name packs** (section 5). There are eleven:

- **Original names:** the names the calendar has always used, and the default.
- **Seven from history:** Anglo-Saxon, Old Norse, Roman, Gaulish, Persian, Egyptian (ancient) and Coptic.
- **Three invented:** Nature, Latin numbers and Sky.

**Original names** are March to February, then Sol. Their meanings:
- March: Mars, god of war
- April: uncertain, possibly *aperire*, "to open"
- May: Maia, a goddess of growth
- June: Juno
- July: Julius Caesar
- August: Augustus
- September to December: "seventh" to "tenth"
- January: Janus, god of doorways and beginnings
- February: *Februa*, a purification festival
- Sol: Latin for "sun". It's borrowed from Moses Cotsworth's International Fixed Calendar, a 13 x 28 design from the early 1900s, where Sol sat between June and July.

Like the other packs, these meanings get checked against sources before release.

Spans are for solar 2026. The historical sets were checked against the sources listed below. Each culture had 12 regular months, so in every set one slot needed a 13th name (marked \*). The notes explain where each 13th name comes from.

### From history

| # | 2026 span | Anglo-Saxon | Old Norse | Roman | Gaulish |
|---|---|---|---|---|---|
| 1 | 23 Mar to 19 Apr | Ēosturmōnaþ | Einmánuður | Martius | Cantlos |
| 2 | 20 Apr to 17 May | Þrimilce | Harpa | Aprilis | Quimonios\* |
| 3 | 18 May to 14 Jun | Ǣrra Līþa | Skerpla | Maius | Samonios |
| 4 | 15 Jun to 12 Jul | Līþa\* | Sólmánuður | Iunius | Dumannios |
| 5 | 13 Jul to 9 Aug | Æftera Līþa | Heyannir | Quintilis | Rivros |
| 6 | 10 Aug to 6 Sep | Weodmōnaþ | Tvímánuður | Sextilis | Anagantios |
| 7 | 7 Sep to 4 Oct | Hāligmōnaþ | Haustmánuður | September | Ogronios |
| 8 | 5 Oct to 1 Nov | Winterfylleþ | Gormánuður | October | Cutios |
| 9 | 2 Nov to 29 Nov | Blōtmōnaþ | Frermánuður\* | November | Giamonios |
| 10 | 30 Nov to 27 Dec | Ǣrra Gēola | Ýlir | December | Simiuisonnios |
| 11 | 28 Dec to 24 Jan | Æftera Gēola | Mörsugur | Ianuarius | Equos |
| 12 | 25 Jan to 21 Feb | Solmōnaþ | Þorri | Februarius | Elembiuios |
| 13 | 22 Feb to 21 Mar | Hrēþmōnaþ | Góa | Mercedonius\* | Edrinios |
| Leap week | | Leap week | Sumarauki | Leap week | Leap week |

**Anglo-Saxon** (Bede, *The Reckoning of Time*, AD 725)
- **Meanings:**
  1. Eostre's month (Easter is named after it)
  2. Three-milkings, because cows were milked three times a day
  3. Before Litha
  4. Litha
  5. After Litha
  6. Weed month
  7. Holy month
  8. Winter full moon
  9. Sacrifice month
  10. Before Yule
  11. After Yule
  12. Cake month, for cakes offered to the gods
  13. Hretha's month

  *Litha* is usually read as "gentle", for calm summer seas.
- **Fit:** every name lands in its historical season.
- **The 13th month:** Bede says that in 13-month years "three months together bore the name Litha", and calls such a year *Thrilithi*. He doesn't give the middle one its own name, so it's plain *Līþa* here.
- **Spellings:** the before/after forms (*Ǣrra*, *Æftera*) are later conventions. Bede wrote *Litha* and *Giuli* for both.
- **Modern forms:** Eostermonth, Thrimilch, Fore-Litha, Litha, After-Litha, Weedmonth, Holymonth, Winterfilth, Blotmonth, Fore-Yule, After-Yule, Solmonth, Rethemonth.
- **Tolkien:** the Shire calendar in *The Lord of the Rings* is built on these names (Thrimidge, Forelithe, Afterlithe, Wedmath, Halimath, Winterfilth, Blotmath, Foreyule, Afteryule, Solmath, Rethe).

**Old Norse / Icelandic** (misseristal)
- **Closest match to this calendar's rules.** The Icelandic year was 364 days. A leap week called *sumarauki* ("summer addition") was added every few years to make 371 days, the same rule this calendar uses. Months also started on fixed weekdays.
- **Differences:**
  - Iceland had 12 months of 30 days plus 4 extra nights.
  - Its leap week went in midsummer, not at the end of the year.
  - Here, months 1 to 4 and 10 to 13 line up within about a week. Months 5 to 9 run about two weeks early.
- **The 13th month:** *Frermánuður* ("frost month") is from Snorri's *Prose Edda*, where it's another name for the Ýlir period.
- **Meanings:** lone month; Harpa (origin unknown, possibly a woman's name); Skerpla (unknown); sun month; hay-work month; "two month" (unclear); autumn month; slaughter month; frost month; Yule month; suet-sucking month; Þorri (unknown, a midwinter figure); Góa (Þorri's daughter in the sagas).

**Roman** (before Julius Caesar)
- **Start in March:** the Roman year began in March, which is why September means "seventh".
- **Quintilis and Sextilis** were the original fifth and sixth months. They were later renamed July and August.
- **The 13th month:** *Mercedonius* (also called *Intercalaris*) was Rome's leap month. It was inserted after 23 February in some years, which is about where month 13 starts here.
- **Downside:** Martius to Februarius are the Latin forms of the Gregorian names, three weeks out of step, which is the confusion the current names have.

**Gaulish** (the Coligny calendar)
- **What it is:** a bronze tablet from about the 2nd century AD, found in France in 1897. It is the only long record of a pre-Roman Celtic calendar.
- **Meanings:** mostly scholarly guesses. *Giamonios* "winter" is the best accepted, and *Equos* "horse" and *Elembiuios* "stag" are plausible.
- **Placement is a choice.** Nobody knows where *Samonios* fell in the year, so putting Giamonios in November here is a choice, not a fact.
- **The 13th month:** *Quimonios* is one of the calendar's two leap months.

### Persian and Egyptian

Neither had a regular 13-month calendar.
- **Persian:** the modern Persian, Zoroastrian and Achaemenid calendars all had 12 months. A 13th month was only added now and then to keep in step.
- **Egyptian:** the civil year was 12 months of 30 days plus 5 extra days, for 365. Only its Christian descendants, the Coptic and Ethiopian calendars, count those 5 days as a "little" 13th month.

| # | 2026 span | Persian | Egyptian (ancient) | Coptic |
|---|---|---|---|---|
| 1 | 23 Mar to 19 Apr | Farvardin | Shemu I | Paremhat |
| 2 | 20 Apr to 17 May | Ordibehesht | Shemu II | Parmouti |
| 3 | 18 May to 14 Jun | Khordad | Shemu III | Pashons |
| 4 | 15 Jun to 12 Jul | Tir | Shemu IV | Paoni |
| 5 | 13 Jul to 9 Aug | Mordad | Heriu Renpet\* | Epip |
| 6 | 10 Aug to 6 Sep | Shahrivar | Akhet I | Mesori |
| 7 | 7 Sep to 4 Oct | Bāgayādiš\* | Akhet II | Nasie\* |
| 8 | 5 Oct to 1 Nov | Mehr | Akhet III | Thout |
| 9 | 2 Nov to 29 Nov | Aban | Akhet IV | Paopi |
| 10 | 30 Nov to 27 Dec | Azar | Peret I | Hathor |
| 11 | 28 Dec to 24 Jan | Dey | Peret II | Koiak |
| 12 | 25 Jan to 21 Feb | Bahman | Peret III | Tobi |
| 13 | 22 Feb to 21 Mar | Esfand | Peret IV | Meshir |
| Leap week | | Gatha days | Leap week | Leap week |

**Persian** (modern Solar Hijri names)
- **Same anchor as this calendar:** the Persian year starts at the March equinox (Nowruz). The old README described these names.
- **Origins:** each name comes from an Avestan spirit or idea. In order: guardian spirits, best truth, wholeness, Sirius the rain-star, immortality, desirable dominion, covenant (Mithra), the waters, fire, the Creator, good mind, holy devotion.
- **The 13th month:** *Bāgayādiš*, "worship of the god" (perhaps Mithra; the meaning is uncertain), is the Old Persian month that fell near the autumn equinox. Putting it at slot 7 keeps every month within about two weeks of its season.
- **Leap week:** named after the Zoroastrian *Gatha days*, the five extra days at the end of the year, also called *panjeh*, "the five".

**Egyptian, ancient** (three seasons of four months)
- **Seasons:** *Akhet* (inundation), *Peret* (emergence, growth) and *Shemu* (harvest). The ideal year began in midsummer with the rising of Sirius, which heralded the Nile flood. That puts Shemu around March to July.
- **The 13th month:** slot 5 is *Heriu Renpet*, "those upon the year". These were the five extra days at year end, celebrated as the birthdays of Osiris, Horus, Set, Isis and Nephthys. Here they stretch to a full 28-day month.

**Coptic** (the later Egyptian month names, still used by the Coptic Church)
- **Origins:** most names come from gods and festivals: Thout from Thoth, Hathor, Pashons from Khonsu, Parmouti from Renenutet. Several meanings are uncertain.
- **The 13th month:** *Nasie* (Pi Kogi Enavot, "the little month") is the real 5 or 6-day 13th month, which falls in early September, matching slot 7.

**Caveat:** some of these meanings came from the researcher's background knowledge, not from fetched sources. They get checked before release, like every pack.

**Sources:**
- https://en.wikipedia.org/wiki/Old_Persian_calendar
- https://en.wikipedia.org/wiki/Zoroastrian_calendar
- https://en.wikipedia.org/wiki/Egyptian_calendar
- https://en.wikipedia.org/wiki/Coptic_calendar

**Also considered:** Charlemagne's Frankish names (Wintarmanoth, Hornung and so on) have no 13th month and weren't checked.

**For the prototype:** every pack ships, so both typefaces must include all the special letters (Þ, ð, ǣ, ō and the other vowels with macrons). If one doesn't, pick another.

**Sources:**
- https://en.wikipedia.org/wiki/Germanic_calendar
- https://roger-pearse.com/weblog/2012/01/20/bede-on-yule
- https://en.wikipedia.org/wiki/Shire_Reckoning
- https://www2.math.uu.se/~svantejs/papers/calendars/iceland.pdf (Janson, the Icelandic calendar)
- https://en.wikipedia.org/wiki/Roman_calendar
- https://en.wikipedia.org/wiki/Coligny_calendar

### Invented sets (earlier shortlist)

| # | Span (2026) | A. Nature | B. Latin numbers | C. Sky |
|---|---|---|---|---|
| 1 | 23 Mar to 19 Apr | Bud | Prima | Pisces |
| 2 | 20 Apr to 17 May | Bloom | Secunda | Aries |
| 3 | 18 May to 14 Jun | Meadow | Tertia | Taurus |
| 4 | 15 Jun to 12 Jul | Light | Quarta | Gemini |
| 5 | 13 Jul to 9 Aug | Heat | Quinta | Cancer |
| 6 | 10 Aug to 6 Sep | Harvest | Sexta | Leo |
| 7 | 7 Sep to 4 Oct | Vintage | Septima | Virgo |
| 8 | 5 Oct to 1 Nov | Ember | Octava | Libra |
| 9 | 2 Nov to 29 Nov | Mist | Nona | Scorpius |
| 10 | 30 Nov to 27 Dec | Dark | Decima | Ophiuchus |
| 11 | 28 Dec to 24 Jan | Frost | Undecima | Sagittarius |
| 12 | 25 Jan to 21 Feb | Snow | Duodecima | Capricornus |
| 13 | 22 Feb to 21 Mar | Thaw | Tredecima | Aquarius |

- **A. Nature:** easy to remember, and "Light" and "Dark" hold the solstices. It assumes northern-hemisphere seasons.
- **B. Latin numbers:** the position is in the name, and there's a nice story. The Roman year began in March, which is why September means "seventh". This calendar also starts in March, so Septima to Decima land almost exactly on September to December.
- **C. Sky:** the sun really does cross 13 constellations along the ecliptic, and these names track roughly where it is, within a few weeks. The downside is the association with astrology.

In the invented sets, the leap week is called "Leap week".

## 5. Technical plan

### Architecture

```
src/core/      pure TypeScript, no DOM, no Date arithmetic
  days.ts      civil date <-> integer day number (Hinnant's days_from_civil), weekday
  astro.ts     Meeus ch. 27 equinox/solstice instants + Espenak-Meeus delta-T
  solar.ts     yearStart(y), yearLength(y), toSolar(day), fromSolar(y, m, d), leap week
  format.ts    formatting; the core deals in month numbers 1 to 13 and the
               leap week, never names
  ics.ts       ICS text generation (takes a name pack)
src/names/     schema.ts + loader; packs/*.json, one file per pack, found
               automatically at build time and loaded on demand
src/ui/        app state (selected day number + view), router, month view,
               year view, day panel, converter, theme, location settings
src/styles/    tokens.css, base.css, components, print.css
tests/unit/    Vitest
tests/e2e/     Playwright, with webServer = vite preview
```

- **All dates are integer day numbers.** A `Date` object is only used to read "now" and to format times. That removes the timezone and clock-change bugs at the root.
- **Equinoxes and solstices are computed.** Meeus takes microseconds and is accurate to about a minute, so there's no JSON, no fetch and no fallback. The supported range is 1600 to 2400, where delta-T is well modelled. 1000 to 3000 is possible but less exact.
- **Sun and moon extras** (rise and set times, moon phases) come from `astronomy-engine`, lazy-loaded only when the day panel needs them. Check its size and licence before adopting it. The core stays small.
- **URLs** use query parameters, so any static host works. `?date=YYYY-MM-DD` is the canonical day link. The old page URLs aren't kept. If an old domain still gets traffic, a Cloudflare redirect rule can send it to the new site.
- **Theme:** a tiny inline script in `<head>` sets the theme before the page paints, and the OS setting is the default.
- **Accessibility:** follows the WAI-ARIA date-grid pattern. Arrow keys move by day, Page Up and Page Down by month, and focus moves with a roving tabindex. Today gets `aria-current="date"`, and each cell's accessible name gives both dates. axe runs in the e2e tests.

### Name packs: a plugin model

**A pack is one file.**
- Each pack is a JSON file in `src/names/packs/`. Vite finds every file there at build time (`import.meta.glob`), so adding a pack means adding one file. There's no registry to edit and no app code to change.
- Each pack builds into its own small chunk, loaded only when someone picks it.
- The ICS Worker reads the same files.

**Format.** `src/names/schema.ts` defines and validates the format. A pack has:
- `id`: stable, because it appears in URLs and feed links. It never changes. An `aliases` list keeps old ids working if one ever has to.
- `title`, a one-line `description`, `culture` and `era`
- `lang`: a language tag such as `ang`, `is`, `la` or `fa`
- an origin note and `sources`
- a leap-week name, for example *Sumarauki*
- 13 months

Each month has:
- `name`: shown in the UI
- `original`: the original form, where it differs. It carries its own language and script direction, so Persian script reads right to left.
- `gloss`: two to four words, such as "holy month"
- `meaning`: a short paragraph
- `certainty`: established, likely or uncertain, shown as plain words
- `notes`: for example "13th name taken from Snorri's *Prose Edda*"

**Adding a pack later**
1. Copy `src/names/packs/_template.json` and fill it in.
2. Run the tests. A schema test fails the build if anything is missing or wrong: fewer or more than 13 months, a missing gloss, meaning or source, an unknown certainty value, or an id that's already taken.
3. `docs/name-packs.md` explains the format and the research standard: cite sources, and mark disputed meanings "uncertain".

**Possible later extensions on the same route:**
- custom packs loaded from a file in the browser
- festivals per pack, such as Nowruz, Yule, Litha and Samhain, shown in the calendar

**Switching**
- A "Month names" control in the header opens a list of the packs. Each entry shows its description and its first three names.
- Choosing one applies instantly with no reload. Only the labels change, because the grid stays put, the same idea as the perennial design.
- The choice is saved in the browser. A `names=` URL parameter overrides it, so a shared link shows the sender's pack.
- The ICS feed and print output take the pack too (`/feed.ics?names=old-norse`).

**Meanings**
- The month heading shows the name with its gloss underneath, for example "Hāligmōnaþ, holy month".
- "About this name" opens a panel with the full meaning, original spelling, certainty, notes and sources. The panel also lists all 13 months of the pack, so people can read it like a short essay.
- The printed year includes a small legend of the 13 names and glosses.

**Language and loading**
- Names are marked with their language (`lang="ang"` for Old English, `is` for Icelandic, `la` for Latin) so screen readers pronounce them better.
- The default pack is in the main bundle. The others load when picked, which keeps the performance budget.
- The display-font subset is built automatically from the Latin-script characters in all packs, so a new pack never shows missing glyphs. Original forms in other scripts, such as Persian or Coptic, use system fonts.

### Tests that guard the review's findings

- Round-trip every day from 1600 to 2400 between Gregorian and solar.
- Invariants:
  - Day 1 of every month is a Monday.
  - Years are only 364 or 371 days long.
  - The leap week appears exactly in 371-day years.
  - No day is left without a solar date.
- Equinox and solstice instants for 1900 to 2100 checked against a published table (USNO or IMCCE) to within 2 minutes. Years where the equinox falls within 5 minutes of UTC midnight are listed explicitly.
- Every name pack has 13 months, each with a name, gloss and meaning, plus a leap-week name and at least one source. An e2e test switches packs and checks that labels, the URL and the saved choice all update.
- e2e runs under several browser time zones (`timezoneId`: London, New York, Tokyo, Kiritimati), so the off-by-one-day bug can't come back.
- Performance budget: core JS under 25 KB gzipped, display font subset, no layout shift, and only the visible view rendered.

### Phases (one PR each, on a `redesign` branch)

0. **Prototype** (built 17 Oct 2026 on the `redesign` branch). A minimal core (days, astro, solar), plus static month view, year view and day panel in light and dark, at desktop and mobile sizes, with real dates. It includes the name-pack switcher and the meaning panel, with two packs. Screenshots for sign-off. You confirm the typefaces and the default pack here.
1. **Core library** (done 17 Oct 2026). Built with the unit tests above. astronomy-engine stands in for the published table, and agrees to within 2 minutes.
2. **App shell.** Vite and TypeScript, tokens, theme, router, month view opening on today, day panel and keyboard navigation. e2e with `webServer` and the time-zone matrix (set up early, during the cleanup).
   - Status, 17 Oct 2026: done apart from the first deploy.
   - Added: self-hosted fonts, the phone header and Back/Forward support.
   - Checks: axe accessibility tests (WCAG 2.2 AA, light and dark) and a strict Content-Security-Policy in `public/_headers`, which the e2e suite runs under.
   - Infrastructure: CI in GitHub Actions and `wrangler.jsonc` for Workers with static assets.
   - Waiting: the first deploy needs `npx wrangler login`. After that, connect the GitHub repo with Workers Builds (Cloudflare dashboard) for automatic deploys and per-PR preview links, with no tokens to manage.
3. **Year view, converter and print styles.** Print output is checked with Playwright's PDF export, which also replaces the hand-made PDFs. Every name pack gets its full meanings, each checked against its sources. The pack template and `docs/name-packs.md` land in this phase too.
4. **Extras.** Sun and moon data (location is opt-in and stored only in the browser), ICS download per year plus a subscribable feed, and the offline PWA.
5. **Launch.** Deploy to Cloudflare. The cleanup planned for this phase was done early: the original app was removed, and the README and `CLAUDE.md` were rewritten, on 17 Oct 2026.

## 6. Hosting

The site is static files plus one dynamic URL: the ICS feed, which calendar apps fetch again every few hours.

| Option | Good | Less good |
|---|---|---|
| **Cloudflare** (recommended) | Free tier, global CDN, HTTPS, a preview URL for every PR, deploys from GitHub. A small Worker can build `/feed.ics` on request from the same TypeScript core, so the feed never goes stale. | Another account and dashboard to manage (you already use Cloudflare). |
| GitHub Pages | Free and simplest; the repo is already there | Static only. The feed would have to be pre-built for a fixed range and refreshed by a scheduled Action. No PR previews. |
| Fasthosts | Already paid for. PHP could generate the feed. | Shared hosting: FTP-style deploys, no CDN, no previews, and PHP would mean a second copy of the date logic, which was the problem with the original `RealTime.php`. |
| AWS (S3 + CloudFront + Lambda) | Very capable | Far more setup and cost than this needs |

**Recommendation:** keep the code on GitHub and use GitHub Actions for tests. Deploy to Cloudflare as Workers with static assets, with a custom domain. Cloudflare's docs now say to start new projects on Workers rather than Pages (checked 17 Oct 2026). Use Workers Builds, which connects the repo in the dashboard, for production deploys from `main` and preview links on other branches. The ICS feed later becomes a small Worker script on `run_worker_first: ["/feed.ics"]`. Fasthosts isn't needed for this project.
