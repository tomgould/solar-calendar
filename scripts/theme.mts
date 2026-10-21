import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';

// Applies a saved theme before the first paint, so dark mode never flashes
// white. It goes inline in every page's <head>, so the first paint waits for no
// extra request. Edit it here: the build works out its hash.
export const THEME_SCRIPT =
  "try{const t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}";

// The Content-Security-Policy allows the inline script by the sha256 hash of its
// exact text, rather than allowing every inline script
export const THEME_SCRIPT_HASH = `'sha256-${createHash('sha256').update(THEME_SCRIPT, 'utf8').digest('base64')}'`;

// Each page's <head> marks where the script goes
export const THEME_MARKER = '<script data-theme-script></script>';

// public/_headers has this in script-src, and the build writes the hash in its place
export const HASH_PLACEHOLDER = '{{THEME_SCRIPT_HASH}}';

export const inlineThemeScript = (html: string, page = 'a page'): string => {
  if (html.split(THEME_MARKER).length !== 2) throw new Error(`${page} needs ${THEME_MARKER} once in its <head>, for the theme script`);
  return html.replace(THEME_MARKER, `<script>${THEME_SCRIPT}</script>`);
};

export const withThemeScriptHash = (headers: string): string => {
  if (!headers.includes(HASH_PLACEHOLDER)) throw new Error(`_headers needs ${HASH_PLACEHOLDER} in script-src, for the theme script`);
  return headers.replaceAll(HASH_PLACEHOLDER, THEME_SCRIPT_HASH);
};

// Inlines the theme script into every page, in development and in the build,
// and writes its hash into the built _headers
export const themeScript = (): Plugin => ({
  name: 'solar-calendar-theme',
  transformIndexHtml: {
    order: 'pre',
    handler: (html, { path }) => inlineThemeScript(html, path),
  },
  async writeBundle({ dir }) {
    // Vite has copied public/ into the output folder by now
    if (!dir) return;
    const file = join(dir, '_headers');
    await writeFile(file, withThemeScriptHash(await readFile(file, 'utf8')));
  },
});
