// Writes src/styles/fallbacks.css: local system fonts reshaped to Andika's
// size and line metrics. Text set in them while Andika loads takes the same
// space, so the swap to Andika moves nothing. Run it again after a Fontsource
// update: npm run fonts:fallbacks (tests/unit/font-fallbacks.test.ts fails
// until you do).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as fontkit from 'fontkit';

export interface Metrics {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  /** Average advance width, weighted by how often each letter and the space occur in English */
  xWidthAvg: number;
}

// Capsize's letter frequencies, so the average matches running text
const WEIGHTS: Record<string, number> = {
  a: 0.0668, b: 0.0122, c: 0.0228, d: 0.0348, e: 0.1039, f: 0.0182, g: 0.0165, h: 0.0499, i: 0.057,
  j: 0.0013, k: 0.0063, l: 0.0329, m: 0.0197, n: 0.0552, o: 0.0614, p: 0.0158, q: 0.0008, r: 0.049,
  s: 0.0518, t: 0.0741, u: 0.0226, v: 0.008, w: 0.0193, x: 0.0012, y: 0.0162, z: 0.0006, ' ': 0.1818,
};

/** A font file's line metrics (hhea) and its average character width. */
export function measure(file: string): Metrics {
  const font = fontkit.openSync(file) as fontkit.Font;
  const sample = Object.keys(WEIGHTS).join('');
  const xWidthAvg = font.glyphsForString(sample).reduce((sum, glyph, index) => sum + glyph.advanceWidth * WEIGHTS[sample[index]], 0);
  return { unitsPerEm: font.unitsPerEm, ascent: font.ascent, descent: font.descent, lineGap: font.lineGap, xWidthAvg };
}

type Face = '400 normal' | '700 normal' | '400 italic';

// The system fonts used while Andika loads, measured with measure(). Arial's
// come from Liberation Sans, which has the same metrics and is what Linux has
// in its place. Roboto's come from Fontsource's Roboto 5.3.0, Google's Roboto,
// which Android uses. Each face lists the full and PostScript names local() matches
export const SYSTEM_FONTS: Record<string, { faces: Record<Face, { local: string[]; metrics: Metrics }> }> = {
  Arial: {
    faces: {
      '400 normal': { local: ['Arial', 'ArialMT', 'Liberation Sans', 'LiberationSans'], metrics: { unitsPerEm: 2048, ascent: 1854, descent: -434, lineGap: 67, xWidthAvg: 903.5 } },
      '700 normal': { local: ['Arial Bold', 'Arial-BoldMT', 'Liberation Sans Bold', 'LiberationSans-Bold'], metrics: { unitsPerEm: 2048, ascent: 1854, descent: -434, lineGap: 67, xWidthAvg: 976.8 } },
      '400 italic': { local: ['Arial Italic', 'Arial-ItalicMT', 'Liberation Sans Italic', 'LiberationSans-Italic'], metrics: { unitsPerEm: 2048, ascent: 1854, descent: -434, lineGap: 67, xWidthAvg: 903.5 } },
    },
  },
  Roboto: {
    faces: {
      '400 normal': { local: ['Roboto', 'Roboto-Regular'], metrics: { unitsPerEm: 2048, ascent: 1900, descent: -500, lineGap: 0, xWidthAvg: 906.2 } },
      '700 normal': { local: ['Roboto Bold', 'Roboto-Bold'], metrics: { unitsPerEm: 2048, ascent: 1900, descent: -500, lineGap: 0, xWidthAvg: 918.2 } },
      '400 italic': { local: ['Roboto Italic', 'Roboto-Italic'], metrics: { unitsPerEm: 2048, ascent: 1900, descent: -500, lineGap: 0, xWidthAvg: 880.8 } },
    },
  },
};

// The Andika faces the site loads, each with its Latin file and Fontsource stylesheet
const ANDIKA = 'node_modules/@fontsource/andika';
const ANDIKA_FACES: Record<Face, { file: string; css: string }> = {
  '400 normal': { file: 'andika-latin-400-normal.woff2', css: '400.css' },
  '700 normal': { file: 'andika-latin-700-normal.woff2', css: '700.css' },
  '400 italic': { file: 'andika-latin-400-italic.woff2', css: '400-italic.css' },
};

export const fallbackFamily = (system: string) => `Andika Fallback ${system}`;

/** size-adjust and the line metric overrides that make `fallback` take the space `font` does, as capsize and fontaine work them out. */
export function overrides(font: Metrics, fallback: Metrics) {
  const sizeAdjust = (font.xWidthAvg / font.unitsPerEm) / (fallback.xWidthAvg / fallback.unitsPerEm);
  // The overrides are scaled by size-adjust too, so divide it back out
  const em = font.unitsPerEm * sizeAdjust;
  return { sizeAdjust, ascent: font.ascent / em, descent: Math.abs(font.descent) / em, lineGap: font.lineGap / em };
}

const percent = (value: number) => `${+(value * 100).toFixed(2)}%`;

/** Every character range Andika covers in a face, so the fallback stands in for those and nothing else. */
const unicodeRange = (css: string) => [...new Set([...readFileSync(`${ANDIKA}/${css}`, 'utf8').matchAll(/unicode-range: ([^;]+);/g)].flatMap((match) => match[1].split(',')))].join(',');

export function fallbackCss(): string {
  const rules = Object.entries(SYSTEM_FONTS).flatMap(([system, { faces }]) =>
    (Object.keys(ANDIKA_FACES) as Face[]).map((face) => {
      const [weight, style] = face.split(' ');
      const andika = ANDIKA_FACES[face];
      const fit = overrides(measure(`${ANDIKA}/files/${andika.file}`), faces[face].metrics);
      return [
        '@font-face {',
        `  font-family: '${fallbackFamily(system)}';`,
        `  font-style: ${style};`,
        `  font-weight: ${weight};`,
        `  src: ${faces[face].local.map((name) => `local('${name}')`).join(', ')};`,
        `  size-adjust: ${percent(fit.sizeAdjust)};`,
        `  ascent-override: ${percent(fit.ascent)};`,
        `  descent-override: ${percent(fit.descent)};`,
        `  line-gap-override: ${percent(fit.lineGap)};`,
        `  unicode-range: ${unicodeRange(andika.css)};`,
        '}',
      ].join('\n');
    }));
  return `/* Generated by scripts/font-fallbacks.mts (npm run fonts:fallbacks); don't edit by hand.
   Arial and Roboto reshaped to Andika's size and line metrics, so text set in
   them while Andika loads takes the same space, and the swap moves nothing. */
${rules.join('\n\n')}
`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync('src/styles/fallbacks.css', fallbackCss());
  console.log('Wrote src/styles/fallbacks.css');
}
