import { posix } from 'node:path';
import type { Plugin } from 'vite';

// Andika, regular, Latin letters: most of the text on every page, including the
// first-visit location notice, the calendar's largest paragraph. Even with
// font-display: swap, the browser holds text back for a moment while its font
// loads. Without a preload, the font is only requested once the page is laid
// out, so it lands just after the first render and that text paints a beat late.
// Preloaded, it usually arrives first and the text paints at once.
export const PRELOADED_FONTS = ['andika-latin-400-normal.woff2'];

// Adds a <link rel="preload"> to every built page for each font, by its hashed
// file name. The build fails if a font isn't there, say after a Fontsource
// rename, rather than quietly preloading nothing
export const preloadFonts = (fonts: readonly string[] = PRELOADED_FONTS): Plugin => ({
  name: 'solar-calendar-preload-fonts',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (html, { path, bundle }) => {
      if (!bundle) return html;
      const assets = Object.values(bundle).filter((file) => file.type === 'asset');
      const tags = fonts.map((name) => {
        const asset = assets.find((file) => file.names.includes(name));
        if (!asset) throw new Error(`Can't preload ${name}: it isn't in the build`);
        const relative = posix.relative(posix.dirname(path), `/${asset.fileName}`);
        const href = relative.startsWith('../') ? relative : `./${relative}`;
        return { tag: 'link', attrs: { rel: 'preload', href, as: 'font', type: 'font/woff2', crossorigin: true }, injectTo: 'head' as const };
      });
      return { html, tags };
    },
  },
});
