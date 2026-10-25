// Writes src/styles/fallbacks.css: local system fonts reshaped to the size and
// line metrics of the design kit's typefaces, Schibsted Grotesk and Libre
// Caslon Text. Text set in them while the real fonts load takes the same
// space, so the swap moves nothing. Run it again after the kit or Fontsource
// changes: npm run fonts:fallbacks (tests/unit/font-fallbacks.test.ts fails
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

export type Face = '400 normal' | '700 normal' | '400 italic';

type SystemFont = Partial<Record<Face, { local: string[]; metrics: Metrics }>>;

// The system fonts used while the real fonts load, measured with measure().
// Each face lists the full and PostScript names local() matches.
// - Arial's come from Liberation Sans, which has the same metrics and is what
//   Linux has in its place; Times New Roman's likewise from Liberation Serif.
// - Roboto's come from Fontsource's Roboto 5.3.0, Google's Roboto, which
//   Android uses; Noto Serif is Android's serif.
export const SYSTEM_FONTS: Record<string, SystemFont> = {
  Arial: {
    '400 normal': { local: ['Arial', 'ArialMT', 'Liberation Sans', 'LiberationSans'], metrics: { unitsPerEm: 2048, ascent: 1854, descent: -434, lineGap: 67, xWidthAvg: 903.5 } },
    '700 normal': { local: ['Arial Bold', 'Arial-BoldMT', 'Liberation Sans Bold', 'LiberationSans-Bold'], metrics: { unitsPerEm: 2048, ascent: 1854, descent: -434, lineGap: 67, xWidthAvg: 976.8 } },
  },
  Roboto: {
    '400 normal': { local: ['Roboto', 'Roboto-Regular'], metrics: { unitsPerEm: 2048, ascent: 1900, descent: -500, lineGap: 0, xWidthAvg: 906.2 } },
    '700 normal': { local: ['Roboto Bold', 'Roboto-Bold'], metrics: { unitsPerEm: 2048, ascent: 1900, descent: -500, lineGap: 0, xWidthAvg: 918.2 } },
  },
  'Times New Roman': {
    '400 normal': { local: ['Times New Roman', 'TimesNewRomanPSMT', 'Liberation Serif', 'LiberationSerif'], metrics: { unitsPerEm: 2048, ascent: 1825, descent: -443, lineGap: 87, xWidthAvg: 818.7 } },
    '700 normal': { local: ['Times New Roman Bold', 'TimesNewRomanPS-BoldMT', 'Liberation Serif Bold', 'LiberationSerif-Bold'], metrics: { unitsPerEm: 2048, ascent: 1825, descent: -443, lineGap: 87, xWidthAvg: 871 } },
    '400 italic': { local: ['Times New Roman Italic', 'TimesNewRomanPS-ItalicMT', 'Liberation Serif Italic', 'LiberationSerif-Italic'], metrics: { unitsPerEm: 2048, ascent: 1825, descent: -443, lineGap: 87, xWidthAvg: 821.9 } },
  },
  'Noto Serif': {
    '400 normal': { local: ['Noto Serif', 'NotoSerif', 'NotoSerif-Regular'], metrics: { unitsPerEm: 1000, ascent: 1069, descent: -293, lineGap: 0, xWidthAvg: 478.5 } },
    '700 normal': { local: ['Noto Serif Bold', 'NotoSerif-Bold'], metrics: { unitsPerEm: 1000, ascent: 1069, descent: -293, lineGap: 0, xWidthAvg: 507.6 } },
    '400 italic': { local: ['Noto Serif Italic', 'NotoSerif-Italic'], metrics: { unitsPerEm: 1000, ascent: 1069, descent: -293, lineGap: 0, xWidthAvg: 464.3 } },
  },
};

const KIT_FONTS = 'public/kit/fonts';

interface Typeface {
  /** The system fonts reshaped to stand in for it */
  systems: string[];
  /** Each face the site uses: its metrics, and the Fontsource stylesheet whose ranges say which characters it covers */
  faces: Partial<Record<Face, { metrics: () => Metrics; css: string }>>;
}

// The kit's two typefaces, measured from the kit's own files. They are the
// Latin files; the Latin Extended ones (src/styles/fonts.css) come from
// Fontsource, so the character ranges are Fontsource's too.
export const TYPEFACES: Record<string, Typeface> = {
  'Schibsted Grotesk': {
    systems: ['Arial', 'Roboto'],
    faces: {
      // The variable font's default instance is its 400
      '400 normal': { metrics: () => measure(`${KIT_FONTS}/schibsted-grotesk-latin-wght-normal.woff2`), css: '@fontsource-variable/schibsted-grotesk/wght.css' },
      // fontkit can't set a WOFF2 font's weight axis, so the bold was measured
      // once from Fontsource's static Schibsted Grotesk 700 (5.3.0), the same design
      '700 normal': { metrics: () => ({ unitsPerEm: 2048, ascent: 2000, descent: -528, lineGap: 0, xWidthAvg: 993 }), css: '@fontsource-variable/schibsted-grotesk/wght.css' },
    },
  },
  'Libre Caslon Text': {
    systems: ['Times New Roman', 'Noto Serif'],
    faces: {
      '400 normal': { metrics: () => measure(`${KIT_FONTS}/libre-caslon-text-latin-400-normal.woff2`), css: '@fontsource/libre-caslon-text/400.css' },
      '700 normal': { metrics: () => measure(`${KIT_FONTS}/libre-caslon-text-latin-700-normal.woff2`), css: '@fontsource/libre-caslon-text/700.css' },
      '400 italic': { metrics: () => measure(`${KIT_FONTS}/libre-caslon-text-latin-400-italic.woff2`), css: '@fontsource/libre-caslon-text/400-italic.css' },
    },
  },
};

export const fallbackFamily = (typeface: string, system: string) => `${typeface} Fallback ${system}`;

/** size-adjust and the line metric overrides that make `fallback` take the space `font` does, as capsize and fontaine work them out. */
export function overrides(font: Metrics, fallback: Metrics) {
  const sizeAdjust = (font.xWidthAvg / font.unitsPerEm) / (fallback.xWidthAvg / fallback.unitsPerEm);
  // The overrides are scaled by size-adjust too, so divide it back out
  const em = font.unitsPerEm * sizeAdjust;
  return { sizeAdjust, ascent: font.ascent / em, descent: Math.abs(font.descent) / em, lineGap: font.lineGap / em };
}

const percent = (value: number) => `${+(value * 100).toFixed(2)}%`;

/** Every character range a face covers, so the fallback stands in for those and nothing else. */
export const unicodeRange = (css: string) => [...new Set([...readFileSync(`node_modules/${css}`, 'utf8').matchAll(/unicode-range: ([^;]+);/g)].flatMap((match) => match[1].split(',')))].join(',');

export function fallbackCss(): string {
  const rules = Object.entries(TYPEFACES).flatMap(([typeface, { systems, faces }]) =>
    systems.flatMap((system) => (Object.keys(faces) as Face[]).map((face) => {
      const [weight, style] = face.split(' ');
      const real = faces[face]!;
      const stand = SYSTEM_FONTS[system][face]!;
      const fit = overrides(real.metrics(), stand.metrics);
      return [
        '@font-face {',
        `  font-family: '${fallbackFamily(typeface, system)}';`,
        `  font-style: ${style};`,
        `  font-weight: ${weight};`,
        `  src: ${stand.local.map((name) => `local('${name}')`).join(', ')};`,
        `  size-adjust: ${percent(fit.sizeAdjust)};`,
        `  ascent-override: ${percent(fit.ascent)};`,
        `  descent-override: ${percent(fit.descent)};`,
        `  line-gap-override: ${percent(fit.lineGap)};`,
        `  unicode-range: ${unicodeRange(real.css)};`,
        '}',
      ].join('\n');
    })));
  return `/* Generated by scripts/font-fallbacks.mts (npm run fonts:fallbacks); don't edit by hand.
   Arial and Roboto reshaped to Schibsted Grotesk, and Times New Roman and Noto
   Serif to Libre Caslon Text, in size and line metrics, so text set in them
   while the real fonts load takes the same space, and the swap moves nothing. */
${rules.join('\n\n')}
`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync('src/styles/fallbacks.css', fallbackCss());
  console.log('Wrote src/styles/fallbacks.css');
}
