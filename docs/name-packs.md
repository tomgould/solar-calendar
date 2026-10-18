# Adding a month name pack

A name pack gives the 13 solar months, and the leap week, a set of names, each with its meaning. Packs are plain JSON files, and the app finds them automatically.

## Steps

1. Copy `src/names/packs/_template.json` to `src/names/packs/<id>.json`. The `id` is lowercase words joined by hyphens, such as `old-norse`, and must match the file name. Files that start with `_` are ignored.
2. Fill it in. `src/names/schema.ts` defines every field. Set `kind` to `historical` for names a culture used, or `modern` for an invented set; it decides the group in the names menu.
3. Run `npx vitest run tests/unit/names.test.ts tests/unit/fonts.test.ts`. The tests fail if anything is missing, or if a name uses a letter the fonts don't have.
4. Run `npm run dev`, pick the pack from "Month names", and read it through in "About this name".

## Placing the months

Month 1 starts on the Monday on or after the March equinox. Each month is 28 days. In solar 2026:

| Slot | 2026 span | Slot | 2026 span |
|---|---|---|---|
| 1 | 23 Mar to 19 Apr | 8 | 5 Oct to 1 Nov |
| 2 | 20 Apr to 17 May | 9 | 2 Nov to 29 Nov |
| 3 | 18 May to 14 Jun | 10 | 30 Nov to 27 Dec |
| 4 | 15 Jun to 12 Jul | 11 | 28 Dec to 24 Jan |
| 5 | 13 Jul to 9 Aug | 12 | 25 Jan to 21 Feb |
| 6 | 10 Aug to 6 Sep | 13 | 22 Feb to 21 Mar |
| 7 | 7 Sep to 4 Oct | | |

Put each name in the slot closest to its historical season. Most traditions have 12 months, so one slot needs a 13th name. Use a real one where you can, such as a historical leap month, and say where it comes from in that month's `notes`.

## Writing standard

- **Sources:** cite at least one source you checked for every pack, and prefer two. Wikipedia is fine as a start; add a scholarly or primary source where you can.
- **Certainty:** `established`, `likely` or `uncertain` describes how sure scholars are of the meaning. When they disagree, choose `uncertain` and say so in the meaning.
- **`gloss`:** two to four words, lower case except proper nouns, such as "winter full moon".
- **`meaning`:** one to three plain sentences in British English.
- **Fonts:** `name` is shown in the display font, Big Shoulders, which lacks a few letters such as `ǣ`. Use the nearest plain form in `name`, and put the exact spelling or script in `original`. For an original in another script, set `originalLang`, and `originalDir: "rtl"` for right-to-left scripts. Other scripts use system fonts.
- **Ids:** an `id` appears in shared links and feed URLs, so don't rename a pack once it's published.

## Pronunciation

Packs whose names aren't English need pronunciations. They take three fields:
- **`say`** on every month (all 13 or none), and on the leap week if its name isn't English. It's a respelling for English speakers, such as `WIN-ter-fil-leth`.
- **`ipa`:** the same sound in the International Phonetic Alphabet, without slashes. Optional, but give it where you can.
- **`pronunciation`** on the pack: one or two sentences on which pronunciation you've given and how sure it is. For example, modern Icelandic, classical Latin as reconstructed, or Egyptologists' convention, where the vowels are a modern guess.

Respellings use hyphens between syllables, with the stressed syllable in capitals. Use these sounds (the same key is shown in the app, from `RESPELLING_KEY` in `src/names/schema.ts`):

| Write | As in | Write | As in | Write | As in |
|---|---|---|---|---|---|
| a | cat | o | hot | th | thin |
| ah | father | oh | go | dh | this |
| air | hair | oo | food | kh | Scottish loch |
| ay | day | uu | foot | gh | a softer kh, as in Dutch g |
| e | bed | ow | now | zh | vision |
| eh | bed, ending a syllable | oy | boy | ng | sing |
| ee | see | u | cup | y | yes |
| i | sit | ur | fur | uh | the a in about |
| eye | eye | aw | law | | |

The "Hear it" button reads a name aloud with the browser's speech synthesis. If the device has a voice for the pack's language, it reads the name itself, or `original` when `originalLang` is set (Persian script, for example). Otherwise an English voice reads `say`, so a good respelling matters even where IPA is given.

## Festivals

A pack can list the festivals of its culture in `festivals`. Each has a `name`, `gloss` and `meaning` like a month, optional `say`, `ipa` and `certainty`, and a `when` rule:

| Rule | Example | Meaning |
|---|---|---|
| `{ "event": "june-solstice" }` | Līþa | The day of an equinox or solstice: `march-equinox`, `june-solstice`, `september-equinox` or `december-solstice` |
| `{ "gregorian": "01-19", "weekday": "friday" }` | Þorrablót | A Gregorian date, or with `weekday`, the first such weekday on or after it. Add `staysOn` to keep the date itself when it falls on that weekday: St Brigid's Day is `{ "gregorian": "02-01", "weekday": "monday", "staysOn": "friday" }` |
| `{ "solar": { "month": 3, "day": 17 } }` | Trinox Samonii | A day of a solar month |
| `{ "easter": true, "offset": -2 }` | Good Friday | Western Easter Sunday, here 2 days before it |
| `{ "date": "2023-05-08" }` | The coronation | One day only |
| `{ "julian": "12-25" }` | Coptic Christmas | A date in the Julian calendar, which Orthodox and Coptic feasts follow |
| `{ "coptic": { "month": 1, "day": 1 } }` | Nayrouz | A date in the Coptic calendar (month 13 is the 5 or 6 extra days) |
| `{ "persian": { "month": 1, "day": 13 } }` | Sizdah Bedar | A date in the Iranian calendar, whose year starts at Nowruz by the Tehran-noon rule |

- Any rule can take `before`, a weekday: the last such weekday before the date. Chaharshanbe Suri is `{ "persian": { "month": 1, "day": 1 }, "before": "wednesday", "offset": -1 }`, the Tuesday evening before the last Wednesday of the year.
- Any rule can take an `offset` in days, applied last.
- `days` gives the length of a festival that lasts more than one day.
- `from` and `until` limit it to a range of Gregorian years, and `moves` gives the date in years it moved, such as `{ "2020": "05-08" }`.
- Use `certainty` for the date and meaning together. Where the historical date is a reconstruction, say so in `meaning`.
- The dialog describes each rule in words ("The first Friday on or after 19 January"), so check that the description reads correctly.

## Public holidays

Public holidays live apart from the name packs, in `src/holidays/`, one file per region or country, so they can be shown with any month names. There are five: England and Wales, Scotland and Northern Ireland (UK bank holidays, from 1971), Ireland (from 1997) and United States (federal holidays, from 1971).

A holiday set has an `id` (the file name), `title`, `description`, `lang`, `sources` and `festivals` in the format above, plus:
- **`country`**, such as `"UK"`. A holiday kept in every set of a country is shown under the country's name, so Christmas Day is "UK, Ireland and US".
- **`dayOffName`**, what a day off is called there: `"bank holiday"`, `"public holiday"` or `"federal holiday"`. Where countries differ, the calendar says "public holiday".
- **`weekendRule`** (optional): where a day off goes when the holiday falls at a weekend. `"next-free-weekday"`, the default, is the UK's rule: the next weekday that isn't already a day off. `"nearest-weekday"` is the US rule: Friday for a Saturday, Monday for a Sunday.
- **`substituteLabel`** (optional): what that day is called, `"substitute day"` unless set. The US set uses `"observed"`.

Each holiday can also have:
- **`bankHoliday: true`**, which marks a day off. It gets a flag in the grid rather than a star.
- **`substituteFrom`**, the year from which a day off at the weekend also gives another day, by the set's `weekendRule`. Ireland's holidays have none: by law they don't move, and employers give a day off within a month, an extra day of leave or an extra day's pay instead.

Any number of sets can be shown at once. A holiday with the same name on the same day in several of them shows once, naming every place it's kept.

What the sets leave out:
- Ireland before 1997, when weekend holidays moved under rules that were unclear for Saturdays.
- US Inauguration Day, which is only for federal staff around Washington, DC.
- US closures by executive order, such as Christmas Eve in some years or a national day of mourning. Staff get the day off with pay, but they aren't federal holidays.

Each set is checked against an official list, saved in `tests/fixtures/`:
- **UK:** GOV.UK's bank holidays (`gov-uk-bank-holidays.json`).
- **US:** OPM's federal holidays (`opm-federal-holidays.json`, from its iCalendar file, which covers about ten years).
- **Ireland:** publishes no list a program can read, so the check uses Nager.Date's (`nager-ireland-public-holidays.json`), which lacks the one-off holiday of 18 March 2022. The test knows about that gap.

`npm run holidays:check` fetches the latest lists and runs the test. A weekly GitHub workflow (`.github/workflows/holidays.yml`) does the same and opens a pull request when a list changes. If the test fails there, add the new holiday on a branch of your own (a `date` rule for a one-off, or `moves` for a holiday moved in one year) and merge it, then run the workflow again. Don't push to the workflow's branch, which it rewrites on every run. The workflow needs the repository setting "Allow GitHub Actions to create and approve pull requests".
