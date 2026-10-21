import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_MARKER, THEME_SCRIPT, THEME_SCRIPT_HASH, inlineThemeScript, withThemeScriptHash } from '../../scripts/theme.mjs';

// Every page the build makes: the calendar and the legal pages
const pages = readdirSync('.').filter((file) => file.endsWith('.html'));
const headers = readFileSync('public/_headers', 'utf8');
const policy = withThemeScriptHash(headers);
const directive = (name: string) => new RegExp(`(?:^|; )${name} ([^;\\n]+)`, 'm').exec(policy)![1].split(' ');
const sha256 = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
// The text of each inline script: those without a src
const inlineScripts = (html: string) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

describe('the inline theme script', () => {
  it('goes in every page, and theme.js is gone', () => {
    expect(pages).toEqual(expect.arrayContaining(['index.html', 'privacy.html', 'terms.html', 'disclaimer.html']));
    for (const page of pages) {
      const html = readFileSync(page, 'utf8');
      expect(html.split(THEME_MARKER), page).toHaveLength(2);
      expect(html, page).not.toContain('theme.js');
      expect(html.indexOf(THEME_MARKER), page).toBeLessThan(html.indexOf('</head>'));
    }
  });

  it('is allowed by the hash of its exact text, and no other inline script is', () => {
    expect(THEME_SCRIPT_HASH).toBe(sha256(THEME_SCRIPT));
    const allowed = directive('script-src');
    for (const page of pages) {
      const scripts = inlineScripts(inlineThemeScript(readFileSync(page, 'utf8'), page));
      expect(scripts, page).toEqual([THEME_SCRIPT]);
      for (const script of scripts) expect(allowed, page).toContain(sha256(script));
    }
    expect(allowed).not.toContain("'unsafe-inline'");
  });

  it('leaves the rest of the policy as it was, still allowing Cloudflare Web Analytics', () => {
    expect(directive('script-src')).toEqual(["'self'", THEME_SCRIPT_HASH, 'https://static.cloudflareinsights.com']);
    expect(directive('connect-src')).toEqual(["'self'", 'https://cloudflareinsights.com']);
    expect(directive('style-src')).toEqual(["'self'"]);
    expect(policy.replace(THEME_SCRIPT_HASH, '{{THEME_SCRIPT_HASH}}')).toBe(headers);
  });

  it('stops the build when a page or _headers has no place for it', () => {
    expect(() => inlineThemeScript('<head></head><body></body>', '/new.html')).toThrow('/new.html');
    expect(() => inlineThemeScript(`<head>${THEME_MARKER}${THEME_MARKER}</head>`)).toThrow();
    expect(() => withThemeScriptHash("script-src 'self'")).toThrow();
  });

  describe('when it runs', () => {
    const run = (saved: string | null, failing = false) => {
      const root = { dataset: {} as Record<string, string> };
      const localStorage = { getItem: () => { if (failing) throw new Error('blocked'); return saved; } };
      new Function('localStorage', 'document', THEME_SCRIPT)(localStorage, { documentElement: root });
      return root.dataset.theme;
    };

    it('applies a saved light or dark theme', () => {
      expect(run('dark')).toBe('dark');
      expect(run('light')).toBe('light');
    });

    it('otherwise leaves the system setting in charge, even when storage is blocked', () => {
      expect(run(null)).toBeUndefined();
      expect(run('purple')).toBeUndefined();
      expect(run('dark', true)).toBeUndefined();
    });
  });
});
