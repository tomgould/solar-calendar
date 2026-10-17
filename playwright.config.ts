import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const london = { timezoneId: 'Europe/London' };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    // Always a fresh build: a leftover preview server would test stale files
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...london } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], ...london } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], ...london } },
    { name: 'phone', use: { ...devices['Pixel 7'], ...london } },
    // The original app was a day out west of UTC, so check far-apart time zones too
    { name: 'new-york', use: { ...devices['Desktop Chrome'], timezoneId: 'America/New_York' } },
    { name: 'tokyo', use: { ...devices['Desktop Chrome'], timezoneId: 'Asia/Tokyo' } },
    { name: 'kiritimati', use: { ...devices['Desktop Chrome'], timezoneId: 'Pacific/Kiritimati' } },
  ],
});
