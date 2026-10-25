import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import { describe, expect, it } from 'vitest';
import type { NamePack } from '../../src/names/schema';
import { forDisplayFont } from '../../src/ui/format';

// Characters the self-hosted fonts really contain, read from the font files
function coverage(...sources: [string, RegExp][]): Set<number> {
  const characters = new Set<number>();
  for (const [dir, file] of sources) {
    const names = readdirSync(dir).filter((entry) => file.test(entry));
    expect(names, `${dir} ${file}`).not.toEqual([]);
    for (const name of names) {
      const font = fontkit.openSync(join(dir, name)) as fontkit.Font;
      for (const codePoint of font.characterSet) characters.add(codePoint);
    }
  }
  return characters;
}

// The design kit's Latin files, and the Latin Extended files src/styles/fonts.css adds
const KIT = 'public/kit/fonts';
const grotesk = coverage([KIT, /^schibsted-grotesk-latin-wght-normal\.woff2$/],
  ['node_modules/@fontsource-variable/schibsted-grotesk/files', /^schibsted-grotesk-latin-ext-wght-normal\.woff2$/]);
const caslon = coverage([KIT, /^libre-caslon-text-latin-400-normal\.woff2$/],
  ['node_modules/@fontsource/libre-caslon-text/files', /^libre-caslon-text-latin-ext-400-normal\.woff2$/]);
const caslonItalic = coverage([KIT, /^libre-caslon-text-latin-400-italic\.woff2$/],
  ['node_modules/@fontsource/libre-caslon-text/files', /^libre-caslon-text-latin-ext-400-italic\.woff2$/]);
// Pronunciations: Andika, plus Noto Sans for the Greek letters (θ)
const ipa = new Set([
  ...coverage(['node_modules/@fontsource/andika/files', /-400-normal\.woff2$/]),
  ...coverage(['node_modules/@fontsource/noto-sans/files', /^noto-sans-greek-400-normal\.woff2$/]),
]);
// Original forms may also use the script fonts loaded for them
const scripts = coverage(
  ['node_modules/@fontsource/vazirmatn/files', /^vazirmatn-arabic-400-normal\.woff2$/],
  ['node_modules/@fontsource/noto-sans-coptic/files', /^noto-sans-coptic-coptic-400-normal\.woff2$/],
);

// Libre Caslon has no Ǣ, nor the macron to build it from. The system serif
// reshaped to Caslon's size (fallbacks.css) draws that one letter in prose
const CASLON_LACKS = ['Ǣ'];

const packs = Object.entries(import.meta.glob<NamePack>('../../src/names/packs/*.json', { eager: true, import: 'default' }))
  .map(([path, pack]) => [path.slice(path.lastIndexOf('/') + 1), pack] as [string, NamePack])
  .filter(([file]) => !file.startsWith('_'));

const missing = (strings: (string | undefined)[], font: Set<number>, allowed: string[] = []) =>
  [...new Set(strings.join('').replace(/\s/g, ''))].filter((character) => !font.has(character.codePointAt(0)!) && !allowed.includes(character));

describe('fonts cover every pack', () => {
  it('reads real coverage (Schibsted Grotesk lacks Ǣ but has Æ and the combining macron)', () => {
    expect(grotesk.has(0x1e2)).toBe(false);
    expect(grotesk.has(0xc6) && grotesk.has(0x304)).toBe(true);
    // ō is only in the Latin Extended file
    expect(grotesk.has(0x14d)).toBe(true);
    expect(ipa.has(0x283)).toBe(true);
  });

  it.each(packs)('%s: month names are all in the display font (Schibsted Grotesk)', (_, pack) => {
    // Names are shown decomposed (forDisplayFont), so Ǣ only needs Æ and a combining macron
    const names = [...pack.months.map((month) => month.name), pack.leapWeek.name].map(forDisplayFont);
    expect(missing(names, grotesk)).toEqual([]);
  });

  it.each(packs)('%s: menus, respellings and festival names are in Schibsted Grotesk', (_, pack) => {
    const strings = [pack.title, pack.description, pack.leapWeek.gloss, pack.leapWeek.say,
      ...pack.months.flatMap((month) => [month.gloss, month.say]),
      ...(pack.festivals ?? []).flatMap((festival) => [festival.name, festival.gloss, festival.meaning, festival.say])];
    expect(missing(strings, grotesk)).toEqual([]);
  });

  it.each(packs)('%s: the reading text is in Libre Caslon', (_, pack) => {
    const strings = [pack.origin, pack.pronunciation, pack.leapWeek.meaning,
      ...pack.months.flatMap((month) => [month.name, month.meaning, month.notes]),
      ...(pack.festivals ?? []).flatMap((festival) => [festival.name, festival.meaning])];
    expect(missing(strings, caslon, CASLON_LACKS)).toEqual([]);
    const glosses = [pack.leapWeek.gloss, ...pack.months.map((month) => month.gloss), ...(pack.festivals ?? []).map((festival) => festival.gloss)];
    expect(missing(glosses, caslonItalic)).toEqual([]);
  });

  it.each(packs)('%s: pronunciations are in Andika', (_, pack) => {
    const strings = [pack.leapWeek.ipa, ...pack.months.map((month) => month.ipa), ...(pack.festivals ?? []).map((festival) => festival.ipa)];
    expect(missing(strings, ipa)).toEqual([]);
  });

  it.each(packs)('%s: original forms are in Libre Caslon italic or a script font (Vazirmatn, Noto Sans Coptic)', (_, pack) => {
    const either = new Set([...caslonItalic, ...scripts]);
    expect(missing(pack.months.map((month) => month.original), either)).toEqual([]);
  });
});
