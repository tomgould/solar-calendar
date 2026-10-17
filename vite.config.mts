import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset URLs, so the build works from any path (previews, sub-folders)
  base: './',
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
