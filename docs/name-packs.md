# Adding a month name pack

A name pack gives the 13 solar months, and the leap week, a set of names, each with its meaning. Packs are plain JSON files, and the app finds them automatically.

## Steps

1. Copy `src/names/packs/_template.json` to `src/names/packs/<id>.json`. The `id` is lowercase words joined by hyphens, such as `old-norse`, and must match the file name. Files that start with `_` are ignored.
2. Fill it in. `src/names/schema.ts` defines every field.
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
