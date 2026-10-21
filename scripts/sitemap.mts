import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';

// Writes sitemap.xml into the build, which public/robots.txt points to. Each page
// is listed at the address its canonical link gives, with the date it last
// changed: a legal page's own "Last updated" line, or for the calendar the date
// of the latest commit (the build date where there is no git history).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type SitemapEntry = { loc: string; lastmod: string };

/** The page's canonical address. A page without one stops the build. */
export const canonicalUrl = (html: string, page = 'a page'): string => {
  const match = /<link\s+rel="canonical"\s+href="([^"]+)"/.exec(html);
  if (!match) throw new Error(`${page} needs <link rel="canonical" href="…">, for the sitemap`);
  return match[1];
};

/** A legal page's "Last updated 18 October 2026" as 2026-10-18, or null for a page without one. */
export const lastUpdated = (html: string): string | null => {
  const match = /class="legal-updated">Last updated (\d{1,2}) (\w+) (\d{4})</.exec(html);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2]) + 1;
  if (month === 0) throw new Error(`"${match[0]}" has no month the sitemap can read`);
  return `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
};

/** The date of the latest commit, or today's date in UTC when git or its history is missing. */
export const latestChange = (): string => {
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch {
    // No git, or not a repository
  }
  return new Date().toISOString().slice(0, 10);
};

export const sitemapEntry = (html: string, page: string, fallbackDate: () => string): SitemapEntry => ({
  loc: canonicalUrl(html, page),
  lastmod: lastUpdated(html) ?? fallbackDate(),
});

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const sitemapXml = (entries: SitemapEntry[]): string => [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries.map(({ loc, lastmod }) => `  <url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod></url>`),
  '</urlset>',
  '',
].join('\n');

// Reads the built pages, in the order given, and writes sitemap.xml beside them
export const sitemap = (pages: string[]): Plugin => ({
  name: 'solar-calendar-sitemap',
  apply: 'build',
  async writeBundle({ dir }) {
    if (!dir) return;
    const entries = await Promise.all(pages.map(async (page) => sitemapEntry(await readFile(join(dir, page), 'utf8'), page, latestChange)));
    await writeFile(join(dir, 'sitemap.xml'), sitemapXml(entries));
  },
});
