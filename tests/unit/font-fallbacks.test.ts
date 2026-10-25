import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type Face, SYSTEM_FONTS, TYPEFACES, fallbackCss, fallbackFamily, measure, overrides, unicodeRange } from '../../scripts/font-fallbacks.mjs';

const css = readFileSync('src/styles/fallbacks.css', 'utf8');
const faces = [...css.matchAll(/@font-face \{([^}]+)\}/g)].map((match) => Object.fromEntries(
  [...match[1].matchAll(/^\s*([a-z-]+): (.+);$/gm)].map((line) => [line[1], line[2]]),
));
const appCss = readFileSync('src/styles/app.css', 'utf8');
const stack = (token: string) => new RegExp(`${token}: ([^;]+);`).exec(appCss)![1].split(', ');

describe('fallback fonts for the kit’s typefaces', () => {
  it('are up to date with the kit’s font files: run npm run fonts:fallbacks if not', () => {
    expect(css).toBe(fallbackCss());
  });

  it('give every face the site uses a reshaped system font, with all four overrides', () => {
    const expected = { 'Schibsted Grotesk': ['400 normal', '700 normal'], 'Libre Caslon Text': ['400 normal', '700 normal', '400 italic'] };
    for (const [typeface, used] of Object.entries(expected)) {
      expect(Object.keys(TYPEFACES[typeface].faces)).toEqual(used);
      for (const system of TYPEFACES[typeface].systems) {
        for (const face of used as Face[]) {
          const [weight, style] = face.split(' ');
          const rule = faces.find((entry) => entry['font-family'] === `'${fallbackFamily(typeface, system)}'` && entry['font-weight'] === weight && entry['font-style'] === style);
          expect(rule, `${typeface} ${system} ${face}`).toBeDefined();
          expect(rule!.src).toMatch(/^local\('[^']+'\)(, local\('[^']+'\))*$/);
          for (const descriptor of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) {
            expect(rule![descriptor], `${typeface} ${system} ${face} ${descriptor}`).toMatch(/^\d+(\.\d+)?%$/);
          }
          // Only the typeface's own letters (Latin and Latin Extended), so Greek
          // and Persian still reach Noto Sans and Vazirmatn
          expect(rule!['unicode-range']).toBe(unicodeRange(TYPEFACES[typeface].faces[face]!.css));
          expect(rule!['unicode-range']).toContain('U+0100-02BA');
        }
      }
    }
  });

  it('make the fallback as wide and as tall as the real font', () => {
    const caslon = measure('public/kit/fonts/libre-caslon-text-latin-400-normal.woff2');
    const times = SYSTEM_FONTS['Times New Roman']['400 normal']!.metrics;
    const fit = overrides(caslon, times);
    expect((times.xWidthAvg / times.unitsPerEm) * fit.sizeAdjust).toBeCloseTo(caslon.xWidthAvg / caslon.unitsPerEm, 6);
    // The overrides are scaled by size-adjust, and then match Caslon's own line metrics
    expect(fit.ascent * fit.sizeAdjust).toBeCloseTo(caslon.ascent / caslon.unitsPerEm, 6);
    expect(fit.descent * fit.sizeAdjust).toBeCloseTo(-caslon.descent / caslon.unitsPerEm, 6);
    expect(caslon).toMatchObject({ unitsPerEm: 1000, ascent: 970, descent: -260, lineGap: 0 });
    // The variable Schibsted Grotesk's default instance is its 400
    expect(measure('public/kit/fonts/schibsted-grotesk-latin-wght-normal.woff2')).toMatchObject({ unitsPerEm: 2048, ascent: 2000, descent: -528, lineGap: 0 });
  });

  it('come straight after each typeface in the font stacks', () => {
    for (const [token, typeface] of [['--font-ui', 'Schibsted Grotesk'], ['--font-text', 'Libre Caslon Text']]) {
      expect(stack(token).slice(0, 3)).toEqual([`'${typeface}'`, ...TYPEFACES[typeface].systems.map((system) => `'${fallbackFamily(typeface, system)}'`)]);
    }
    expect(readFileSync('src/styles.ts', 'utf8')).toContain("import './styles/fallbacks.css';");
  });
});
