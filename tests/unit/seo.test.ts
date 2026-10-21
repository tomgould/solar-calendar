import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalUrl, lastUpdated, latestChange, sitemapEntry, sitemapXml } from '../../scripts/sitemap.mjs';

const ORIGIN = 'https://solar.dealmobile.co.uk';
const PERSON_ID = 'https://www.dealmobile.co.uk/#person';
const read = (file: string) => readFileSync(file, 'utf8');
const LEGAL = ['privacy.html', 'terms.html', 'disclaimer.html'];

describe('the sitemap', () => {
  it('lists each page at its canonical address, with the date it last changed', () => {
    expect(sitemapXml([
      { loc: `${ORIGIN}/`, lastmod: '2026-10-21' },
      { loc: `${ORIGIN}/privacy`, lastmod: '2026-10-18' },
    ])).toBe([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      `  <url><loc>${ORIGIN}/</loc><lastmod>2026-10-21</lastmod></url>`,
      `  <url><loc>${ORIGIN}/privacy</loc><lastmod>2026-10-18</lastmod></url>`,
      '</urlset>',
      '',
    ].join('\n'));
    expect(sitemapXml([{ loc: `${ORIGIN}/?a=1&b=2`, lastmod: '2026-10-21' }])).toContain('?a=1&amp;b=2');
  });

  it('dates a legal page by its "Last updated" line, and the calendar by the latest change', () => {
    expect(lastUpdated('<p class="legal-updated">Last updated 8 March 2027</p>')).toBe('2027-03-08');
    expect(lastUpdated('<p class="legal-updated">Last updated 18 October 2026</p>')).toBe('2026-10-18');
    expect(lastUpdated('<main></main>')).toBeNull();
    expect(() => lastUpdated('<p class="legal-updated">Last updated 8 Smarch 2027</p>')).toThrow();
    expect(latestChange()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sitemapEntry(read('index.html'), 'index.html', () => '2026-01-01')).toEqual({ loc: `${ORIGIN}/`, lastmod: '2026-01-01' });
  });

  it('stops the build when a page has no canonical link', () => {
    expect(() => canonicalUrl('<head></head>', 'new.html')).toThrow('new.html');
  });

  it('finds a canonical address on this site and a date on every page', () => {
    expect(canonicalUrl(read('index.html'))).toBe(`${ORIGIN}/`);
    for (const page of LEGAL) {
      expect(canonicalUrl(read(page)), page).toBe(`${ORIGIN}/${page.replace('.html', '')}`);
      expect(lastUpdated(read(page)), page).toMatch(/^2\d{3}-\d{2}-\d{2}$/);
    }
  });

  it('is named in robots.txt', () => {
    expect(read('public/robots.txt')).toMatch(new RegExp(`^Sitemap: ${ORIGIN}/sitemap\\.xml$`, 'm'));
  });
});

describe('the calendar page', () => {
  const html = read('index.html');

  it('has a single h1 before any script runs', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(/<h1 id="month-title"/);
    expect(html).toMatch(/<h2 id="year-title"/);
  });

  it('has a descriptive title, and a description of 120 to 160 characters', () => {
    expect(/<title>([^<]+)<\/title>/.exec(html)![1]).toBe('Solar Calendar: 13 months of 28 days');
    const description = /<meta name="description" content="([^"]+)">/.exec(html)![1];
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/equinox/);
    expect(description).toMatch(/leap week/);
    expect(description).toMatch(/feed/);
  });

  describe('structured data', () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    type Thing = Record<string, unknown> & { '@type': string };
    const graph = (): Thing[] => JSON.parse(blocks[0][1])['@graph'];
    const find = (type: string) => graph().find((thing) => thing['@type'] === type)!;

    it('is one JSON-LD block that parses', () => {
      expect(blocks).toHaveLength(1);
      expect(JSON.parse(blocks[0][1])['@context']).toBe('https://schema.org');
    });

    it('describes the calendar as a free web application', () => {
      expect(find('WebApplication')).toMatchObject({
        name: 'Solar Calendar',
        url: `${ORIGIN}/`,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        inLanguage: 'en-GB',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
        publisher: { '@id': PERSON_ID },
      });
      expect(find('WebApplication').description).toBe(/<meta name="description" content="([^"]+)">/.exec(html)![1]);
      expect(find('WebSite')).toMatchObject({ name: 'Solar Calendar', url: `${ORIGIN}/`, publisher: { '@id': PERSON_ID } });
    });

    it('names the author with just a name and a web address, nothing about where he is', () => {
      expect(find('Person')).toEqual({ '@type': 'Person', '@id': PERSON_ID, name: 'Tom Gould', url: 'https://www.dealmobile.co.uk/' });
      expect(blocks[0][1]).not.toMatch(/"(address|geo|location|homeLocation|workLocation|areaServed)"/);
    });
  });
});
