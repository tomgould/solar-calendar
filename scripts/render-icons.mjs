// Renders the PWA and touch icons in public/icons/ from public/favicon.svg:
//   node scripts/render-icons.mjs
// The touch and maskable icons fill the square with the ink, since the phone
// rounds or crops them itself; the maskable one keeps the sun inside the
// middle 80%, the safe zone.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/favicon.svg', 'utf8');
const icons = [
  { file: 'apple-touch-icon.png', size: 180, fullBleed: true, scale: 1 },
  { file: 'icon-192.png', size: 192, fullBleed: false, scale: 1 },
  { file: 'icon-512.png', size: 512, fullBleed: false, scale: 1 },
  { file: 'maskable-512.png', size: 512, fullBleed: true, scale: 0.8 },
];

const browser = await chromium.launch();
for (const { file, size, fullBleed, scale } of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const art = fullBleed ? svg.replace('rx="7" ', '') : svg;
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:${fullBleed ? '#11100e' : 'transparent'}}
    div{width:${size}px;height:${size}px;display:grid;place-items:center}svg{width:${size * scale}px;height:${size * scale}px}</style><div>${art}</div>`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: !fullBleed });
  await page.close();
}
await browser.close();
console.log('Wrote public/icons/');
