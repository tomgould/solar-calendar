import type { HtmlTagDescriptor, IndexHtmlTransformContext, IndexHtmlTransformResult } from 'vite';
import { describe, expect, it } from 'vitest';
import { PRELOADED_FONTS, preloadFonts } from '../../scripts/preload-fonts.mjs';

const html = '<html><head></head><body></body></html>';
const font = { type: 'asset', names: ['andika-latin-400-normal.woff2'], fileName: 'assets/andika-latin-400-normal-abc123.woff2' };
const other = { type: 'asset', names: ['big-shoulders-latin-opsz-normal.woff2'], fileName: 'assets/big-shoulders-latin-opsz-normal-def456.woff2' };

const run = (bundle: object | undefined, path = '/index.html') => {
  const hook = preloadFonts().transformIndexHtml as { handler: (html: string, ctx: IndexHtmlTransformContext) => IndexHtmlTransformResult };
  return hook.handler(html, { path, filename: path, bundle } as unknown as IndexHtmlTransformContext);
};

describe('font preload', () => {
  it('preloads the main text font by its hashed name, as fonts must be fetched', () => {
    expect(PRELOADED_FONTS).toEqual(['andika-latin-400-normal.woff2']);
    expect(run({ a: other, b: font })).toEqual({
      html,
      tags: [{
        tag: 'link',
        attrs: { rel: 'preload', href: './assets/andika-latin-400-normal-abc123.woff2', as: 'font', type: 'font/woff2', crossorigin: true },
        injectTo: 'head',
      }],
    });
  });

  it('points at the font from pages in sub-folders too', () => {
    const { tags } = run({ b: font }, '/guide/index.html') as { tags: HtmlTagDescriptor[] };
    expect(tags[0].attrs?.href).toBe('../assets/andika-latin-400-normal-abc123.woff2');
  });

  it('stops the build if the font has gone, rather than preloading nothing', () => {
    expect(() => run({ a: other })).toThrow('andika-latin-400-normal.woff2');
  });

  it('does nothing in the dev server, which has no bundle', () => {
    expect(run(undefined)).toBe(html);
  });
});
