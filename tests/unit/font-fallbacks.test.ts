import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SYSTEM_FONTS, fallbackCss, fallbackFamily, measure, overrides } from '../../scripts/font-fallbacks.mjs';

const css = readFileSync('src/styles/fallbacks.css', 'utf8');
const faces = [...css.matchAll(/@font-face \{([^}]+)\}/g)].map((match) => Object.fromEntries(
  [...match[1].matchAll(/^\s*([a-z-]+): (.+);$/gm)].map((line) => [line[1], line[2]]),
));
const andikaRanges = (file: string) => new Set([...readFileSync(`node_modules/@fontsource/andika/${file}`, 'utf8').matchAll(/unicode-range: ([^;]+);/g)].flatMap((match) => match[1].split(',')));

describe('Andika fallback fonts', () => {
  it('are up to date with the Andika files: run npm run fonts:fallbacks if not', () => {
    expect(css).toBe(fallbackCss());
  });

  it('give every Andika face a reshaped Arial and Roboto, with all four overrides', () => {
    for (const system of Object.keys(SYSTEM_FONTS)) {
      for (const [weight, style, file] of [['400', 'normal', '400.css'], ['700', 'normal', '700.css'], ['400', 'italic', '400-italic.css']]) {
        const face = faces.find((rule) => rule['font-family'] === `'${fallbackFamily(system)}'` && rule['font-weight'] === weight && rule['font-style'] === style);
        expect(face, `${system} ${weight} ${style}`).toBeDefined();
        expect(face!.src).toMatch(/^local\('[^']+'\)(, local\('[^']+'\))*$/);
        for (const descriptor of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) {
          expect(face![descriptor], `${system} ${weight} ${style} ${descriptor}`).toMatch(/^\d+(\.\d+)?%$/);
        }
        // Only Andika's own letters, so Greek and Persian still reach Noto Sans and Vazirmatn
        expect(new Set(face!['unicode-range'].split(','))).toEqual(andikaRanges(file));
      }
    }
  });

  it('make the fallback as wide and as tall as Andika', () => {
    const andika = measure('node_modules/@fontsource/andika/files/andika-latin-400-normal.woff2');
    const arial = SYSTEM_FONTS.Arial.faces['400 normal'].metrics;
    const fit = overrides(andika, arial);
    expect((arial.xWidthAvg / arial.unitsPerEm) * fit.sizeAdjust).toBeCloseTo(andika.xWidthAvg / andika.unitsPerEm, 6);
    // The overrides are scaled by size-adjust, and then match Andika's own line metrics
    expect(fit.ascent * fit.sizeAdjust).toBeCloseTo(andika.ascent / andika.unitsPerEm, 6);
    expect(fit.descent * fit.sizeAdjust).toBeCloseTo(-andika.descent / andika.unitsPerEm, 6);
    expect(andika).toMatchObject({ unitsPerEm: 2048, ascent: 2500, descent: -800, lineGap: 0 });
  });

  it('come straight after Andika in the text font stack', () => {
    const stack = /--font-text: ([^;]+);/.exec(readFileSync('src/styles/app.css', 'utf8'))![1].split(', ');
    expect(stack.slice(0, 3)).toEqual(["'Andika'", `'${fallbackFamily('Arial')}'`, `'${fallbackFamily('Roboto')}'`]);
    expect(readFileSync('src/styles.ts', 'utf8')).toContain("import './styles/fallbacks.css';");
  });
});
