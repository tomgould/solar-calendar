import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import { describe, expect, it } from 'vitest';
import type { NamePack } from '../../src/names/schema';

// Characters the self-hosted fonts really contain, read from the font files
function coverage(dir: string, file: RegExp): Set<number> {
  const characters = new Set<number>();
  for (const name of readdirSync(dir).filter((entry) => file.test(entry))) {
    const font = fontkit.openSync(join(dir, name)) as fontkit.Font;
    for (const codePoint of font.characterSet) characters.add(codePoint);
  }
  return characters;
}

const display = coverage('node_modules/@fontsource-variable/big-shoulders/files', /opsz-normal\.woff2$/);
const text = coverage('node_modules/@fontsource/andika/files', /-400-normal\.woff2$/);

const packs = Object.entries(import.meta.glob<NamePack>('../../src/names/packs/*.json', { eager: true, import: 'default' }))
  .map(([path, pack]) => [path.slice(path.lastIndexOf('/') + 1), pack] as [string, NamePack])
  .filter(([file]) => !file.startsWith('_'));

const missing = (strings: (string | undefined)[], font: Set<number>) =>
  [...new Set(strings.join('').replace(/\s/g, ''))].filter((character) => !font.has(character.codePointAt(0)!));

describe('fonts cover every pack', () => {
  it('reads real coverage (Big Shoulders lacks ǣ, Andika has it)', () => {
    expect(display.has(0x1e3)).toBe(false);
    expect(text.has(0x1e3)).toBe(true);
  });

  it.each(packs)('%s: month names are all in the display font (Big Shoulders)', (_, pack) => {
    // Big Shoulders lacks ǣ, for example, so a display name writes Æ and keeps ǣ for "original"
    expect(missing([...pack.months.map((month) => month.name), pack.leapWeek.name], display)).toEqual([]);
  });

  it.each(packs)('%s: all other text is in the body font (Andika)', (_, pack) => {
    // "original" may be in another script (Persian, Coptic), which falls back to system fonts
    const strings = [pack.title, pack.description, pack.origin, pack.leapWeek.gloss, pack.leapWeek.meaning,
      ...pack.months.flatMap((month) => [month.name, month.gloss, month.meaning, month.notes])];
    expect(missing(strings, text)).toEqual([]);
  });
});
