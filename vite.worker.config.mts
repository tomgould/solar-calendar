import { defineConfig } from 'vite';

// Builds src/worker.ts into one ES module for Cloudflare (wrangler.jsonc "main").
// Vite rather than wrangler's own bundler, because the Worker uses import.meta.glob
// to bundle every name pack.
export default defineConfig({
  build: {
    ssr: 'src/worker.ts',
    outDir: 'dist-worker',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: { output: { entryFileNames: 'worker.js', format: 'es' } },
  },
  ssr: { noExternal: true, target: 'webworker' },
});
