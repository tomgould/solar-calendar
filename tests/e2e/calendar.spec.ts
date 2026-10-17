import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { type Page, test as base, expect } from '@playwright/test';

// Every test fails if the page throws
const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

const selectedCell = '#grid-body [aria-selected="true"] .cell';

test('opens on today, in both calendars', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#today-line')).toContainText('Today is');
  await expect(page.locator('#grid-body [aria-current="date"]')).toHaveCount(1);
  await expect(page.locator(selectedCell)).toHaveAttribute('aria-current', 'date');
});

test('gives the same solar date in every time zone', async ({ page }) => {
  await page.goto('./?date=2026-03-23&names=gregorian');
  await expect(page.locator('#month-name')).toHaveText('March');
  await expect(page.locator(selectedCell)).toHaveAccessibleName(/^1 March 2026, Monday 23 March 2026/);

  await page.goto('./?date=2026-10-17&names=gregorian');
  await expect(page.locator(selectedCell)).toHaveAccessibleName(/^13 October 2026, Saturday 17 October 2026/);
});

test('moves by day, week and month with the keyboard', async ({ page }) => {
  await page.goto('./?date=2026-10-17&names=anglo-saxon');
  await page.locator(selectedCell).focus();
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown']) await page.keyboard.press(key);
  await expect(page).toHaveURL(/date=2026-10-26/);
  await expect(page.locator(':focus')).toHaveAccessibleName(/^22 Winterfylleþ 2026/);

  await page.keyboard.press('PageDown');
  await expect(page).toHaveURL(/date=2026-11-23/);
  await expect(page.locator('#month-name')).toHaveText('Blōtmōnaþ');
});

test('switches month names and remembers the choice', async ({ page }) => {
  await page.goto('./?date=2026-10-17&names=gregorian');
  await expect(page.locator('#month-name')).toHaveText('October');

  await page.locator('#names-button').click();
  await page.locator('input[value="anglo-saxon"]').check();
  await expect(page.locator('#month-name')).toHaveText('Winterfylleþ');
  await expect(page).toHaveURL(/names=anglo-saxon/);

  await page.goto('./');
  await expect(page.locator('#names-current')).toHaveText('Anglo-Saxon');
});

test('explains what each month name means', async ({ page }) => {
  await page.goto('./?date=2026-10-17&names=anglo-saxon');
  await page.locator('#about-name').click();
  const dialog = page.locator('#about-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('li[aria-current]')).toContainText('winter full moon');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('ends a 371-day year with a leap week', async ({ page }) => {
  await page.goto('./?date=2029-03-21&names=gregorian');
  await expect(page.locator('#month-name')).toHaveText('Leap week');
  await expect(page.locator('#grid-body tr:not([hidden]) .cell')).toHaveCount(7);
  await expect(page.locator('#day-panel h2')).toHaveText('Leap week, day 3, 2028');
});

test('shows every day of the year in the year view', async ({ page }) => {
  await page.goto('./?view=year&date=2026-10-17&names=anglo-saxon');
  await expect(page.locator('#almanac td[data-day]')).toHaveCount(364);
  const overflowing = await page.locator('#almanac thead th').evaluateAll((headers) =>
    headers.filter((th) => th.scrollWidth > th.clientWidth + 1).length);
  expect(overflowing).toBe(0);

  await page.goto('./?view=year&date=2028-06-01&names=gregorian');
  await expect(page.locator('#almanac td[data-day]')).toHaveCount(371);
});

test('converts between the calendars with Go to a date', async ({ page }) => {
  await page.goto('./?date=2026-10-17&names=gregorian');
  // Both forms start on the selected day
  await expect(page.locator('#goto-gregorian-date')).toHaveValue('2026-10-17');
  await expect(page.locator('#goto-solar-day')).toHaveValue('13');
  await expect(page.locator('#goto-solar-year')).toHaveValue('2026');

  await page.locator('#goto-gregorian-date').fill('2029-03-21');
  await page.locator('#goto-gregorian').getByRole('button', { name: 'Go' }).click();
  await expect(page.locator('#month-name')).toHaveText('Leap week');
  await expect(page.locator('#goto-solar-day')).toHaveValue('3');

  await page.locator('#goto-solar-day').fill('1');
  await page.locator('#goto-solar-year').fill('2027');
  await page.locator('#goto-solar-year').dispatchEvent('change');
  await page.locator('#goto-solar-month').selectOption({ label: 'March' });
  await page.locator('#goto-solar').getByRole('button', { name: 'Go' }).click();
  await expect(page.locator(selectedCell)).toHaveAccessibleName(/^1 March 2027, Monday 22 March 2027/);
  await expect(page.locator('#goto-gregorian-date')).toHaveValue('2027-03-22');

  // 2026 has no leap week, so it isn't offered
  await page.locator('#goto-solar-year').fill('2026');
  await page.locator('#goto-solar-year').dispatchEvent('change');
  await expect(page.locator('#goto-solar-month option')).toHaveCount(13);
});

test('downloads the year and offers a subscription feed', async ({ page }) => {
  await page.goto('./?view=year&date=2026-10-17&names=anglo-saxon');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-ics').click()]);
  expect(download.suggestedFilename()).toBe('solar-calendar-2026-anglo-saxon.ics');
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(chunk as Buffer);
  const file = Buffer.concat(chunks).toString('utf8');
  expect(file.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(file).toContain('SUMMARY:13 Winterfylleþ 2026');

  // The feed is served by the built Worker bundle
  const feedUrl = await page.locator('#feed-url').inputValue();
  expect(feedUrl).toMatch(/\/feed\.ics\?names=anglo-saxon$/);
  await expect(page.locator('#open-feed')).toHaveAttribute('href', /^webcal:/);
  const feed = await page.request.get(feedUrl);
  expect(feed.headers()['content-type']).toBe('text/calendar; charset=utf-8');
  expect(await feed.text()).toContain('X-WR-CALNAME:Solar calendar (Anglo-Saxon)');
});

test('shows sunrise and sunset once a location is set', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Location emulation, one project');
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
  await page.goto('./?date=2026-06-21&names=gregorian');
  await page.locator('#day-panel [data-set-location]').click();
  await page.locator('#use-my-location').click();
  await expect(page.locator('#location-lat')).toHaveValue('51.51');
  await page.locator('#location-form').getByRole('button', { name: 'Save' }).click();
  const sun = page.locator('#day-panel [data-sun]');
  await expect(sun).toContainText(/Sunrise 04:4\d, sunset 21:2\d BST\. 16 h \d+ min of daylight/);

  // Forgetting the location goes back to offering it
  await sun.getByRole('button', { name: 'Change place' }).click();
  await page.locator('#clear-location').click();
  await expect(sun).toHaveText('Add your location');
});

test('switches theme, offering the other mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  const button = page.locator('#theme-button');
  await expect(button).toHaveAccessibleName('Dark mode');
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(button).toHaveAccessibleName('Light mode');
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(button).toHaveAccessibleName('Dark mode');
});

test('prints the month or the year on one page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'PDF output is Chromium only');
  const pages = async () => {
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  };
  // Dark mode on screen must still print in light colours
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./?date=2026-10-17&names=anglo-saxon');
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  await expect(page.locator('.masthead')).toBeHidden();
  await expect(page.locator('#day-panel')).toBeHidden();
  await expect(page.locator('#month-meaning')).toContainText('Winterfylleþ: Bede says');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
  expect(await pages()).toBe(1);

  await page.emulateMedia({ media: 'screen' });
  await page.goto('./?view=year&date=2028-06-01&names=anglo-saxon');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#almanac')).toBeVisible();
  expect(await pages()).toBe(1);
});

test('goes back to the previous month with the Back button', async ({ page }) => {
  await page.goto('./?date=2026-10-17&names=gregorian');
  await page.locator('#next-month').click();
  await expect(page.locator('#month-name')).toHaveText('November');
  await page.goBack();
  await expect(page.locator('#month-name')).toHaveText('October');
});

test.describe('under the production Content-Security-Policy', () => {
  // A service worker would answer requests before page.route could add the policy
  test.use({ serviceWorkers: 'block' });

  test('works without anything being blocked', async ({ page }) => {
    // The same policy Cloudflare serves, from public/_headers
    const csp = /Content-Security-Policy: (.+)/.exec(readFileSync('public/_headers', 'utf8'))![1];
    await page.route('**/*', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });
    await page.addInitScript(() => {
      const blocked: string[] = [];
      (window as unknown as { blocked: string[] }).blocked = blocked;
      document.addEventListener('securitypolicyviolation', (event) => blocked.push(`${event.violatedDirective} ${event.blockedURI}`));
    });

    await page.goto('./?date=2026-10-17&names=anglo-saxon');
    await expect(page.locator('#month-name')).toHaveText('Winterfylleþ');
    await expect(page.locator('#day-panel [data-moon]')).not.toHaveText(/^\s*$/);
    await page.locator('#about-name').click();
    await page.goto('./?view=year&date=2026-10-17');
    await expect(page.locator('#almanac td[data-day]')).toHaveCount(364);
    expect(await page.evaluate(() => (window as unknown as { blocked: string[] }).blocked)).toEqual([]);
    // Font requests can still be in flight; let them finish unintercepted
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});

test('works offline after the first visit', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Service worker test, one project');
  await page.goto('./?date=2026-10-17&names=anglo-saxon');
  // Wait for the service worker to finish precaching and take control
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 15_000 });

  await context.setOffline(true);
  await page.goto('./?date=2026-06-21&names=gregorian');
  await expect(page.locator('#month-name')).toHaveText('June');
  await expect(page.locator('#day-panel [data-moon]')).toHaveText(/moon|quarter|crescent|gibbous/i);
  // A pack never opened before still loads
  await page.locator('#names-button').click();
  await page.locator('input[value="old-norse"]').check();
  await expect(page.locator('#month-name')).toHaveText('Sólmánuður');
  await context.setOffline(false);
});

test('passes automated accessibility checks', async ({ page }, testInfo) => {
  test.skip(!['chromium', 'phone'].includes(testInfo.project.name), 'Runs in one desktop and one phone project');
  const check = async (where: string) => {
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`), where).toEqual([]);
  };
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('./?date=2026-10-17&names=anglo-saxon');
    await check(`month view, ${colorScheme}`);
    await page.locator('#names-button').click();
    await check(`names menu, ${colorScheme}`);
    await page.keyboard.press('Escape');
    await page.locator('#about-name').click();
    await check(`meaning dialog, ${colorScheme}`);
    await page.goto('./?view=year&date=2026-10-17&names=anglo-saxon');
    await check(`year view, ${colorScheme}`);
  }
});

test('never scrolls the page sideways', async ({ page }) => {
  for (const path of ['./', './?view=year']) {
    await page.goto(path);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sideways, path).toBeLessThanOrEqual(0);
  }
});
