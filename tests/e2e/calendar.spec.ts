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
  await expect(page.locator('#today-line')).toContainText(/(The (March|June|September|December) (equinox|solstice) is (tomorrow|in \d+ days)|It’s the .+ today)\.$/);
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

test('shows how to say each name', async ({ page }) => {
  await page.goto('./?date=2026-12-10&names=anglo-saxon');
  // Ǣ is built from Æ and a combining macron, which the display font has
  await expect(page.locator('#month-name')).toHaveText('Ǣrra Gēola');
  await expect(page.locator('#month-say')).toHaveText(/^Say [A-Z]/);
  await page.locator('#about-name').click();
  await expect(page.locator('#about-dialog li[aria-current] .ipa')).toHaveText(/^\/.+\/$/);
  await page.locator('#about-dialog .say-key summary').click();
  await expect(page.locator('#about-dialog .say-key')).toContainText('as in thin');
  await page.keyboard.press('Escape');

  // English names need no pronunciation
  await page.goto('./?date=2026-12-10&names=gregorian');
  await expect(page.locator('#month-say')).toBeHidden();
});

test('reads names aloud', async ({ page }) => {
  // A stand-in for speech synthesis, with an English and a Persian voice
  await page.addInitScript(() => {
    const spoken: { text: string; lang: string }[] = [];
    Object.assign(window, { spoken });
    class Utterance { lang = ''; voice = null; rate = 1; constructor(public text: string) {} }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        addEventListener() {},
        getVoices: () => [{ lang: 'en-GB', name: 'English' }, { lang: 'fa-IR', name: 'Persian' }],
        speak: (utterance: Utterance) => spoken.push({ text: utterance.text, lang: utterance.lang }),
      },
    });
  });
  const spoken = () => page.evaluate(() => (window as unknown as { spoken: unknown[] }).spoken.at(-1));

  // No Old English voice exists, so an English one reads the respelling
  await page.goto('./?date=2026-12-10&names=anglo-saxon');
  await page.locator('#month-say').getByRole('button', { name: 'Hear Ǣrra Gēola' }).click();
  expect(await spoken()).toEqual({ text: expect.stringMatching(/^[a-z ]+$/), lang: 'en-GB' });

  // Persian names are read in Persian, from the Persian script
  await page.goto('./?date=2026-10-17&names=persian');
  await page.locator('#month-say .hear').click();
  expect(await spoken()).toEqual({ text: expect.stringMatching(/^[؀-ۿ\s]+$/), lang: 'fa-IR' });
  await page.locator('#about-name').click();
  // 13 months and the leap week
  await expect(page.locator('#about-dialog .about-months .hear')).toHaveCount(14);
});

test('marks festivals and explains them', async ({ page }) => {
  // Þorrablót: the first Friday on or after 19 January, 23 January in 2026
  await page.goto('./?date=2026-01-23&names=old-norse');
  await expect(page.locator(selectedCell)).toHaveAccessibleName(/Bóndadagur \(Þorrablót\)/);
  await expect(page.locator('#day-panel')).toContainText('Bóndadagur (Þorrablót)');
  await page.locator('#about-name').click();
  await expect(page.locator('#about-dialog .about-festivals')).toContainText('The first Friday on or after 19 January');
  await expect(page.locator('#about-dialog .about-festivals .about-next').first()).toContainText(/^Next: /);
  await page.keyboard.press('Escape');

  // The menu groups packs, history first
  await page.locator('#names-button').click();
  await expect(page.locator('.pack-group legend')).toHaveText(['From history', 'Modern inventions']);
  await expect(page.locator('.pack-group').first().locator('.pack-title').first()).toHaveText('Gregorian names');
});

test('shows public holidays and other packs’ festivals, chosen in the Festivals menu', async ({ page }) => {
  await page.goto('./?date=2026-12-25&names=gregorian');
  // Everything is on to begin with: Christmas is a day off in every country
  await expect(page.locator('#day-panel')).toContainText('Christmas Day (UK, Ireland and US)');
  await expect(page.locator('#day-panel dt').first()).toHaveText('Public holiday');
  await page.locator('#festivals-button').click();
  const menu = page.locator('#festivals-menu');
  await expect(menu.getByRole('checkbox')).toHaveCount(13);
  for (const box of await menu.getByRole('checkbox').all()) await expect(box).toBeChecked();
  // Keep Northern Ireland, Scotland and the Persian festivals
  await menu.getByLabel('England and Wales').uncheck();
  await menu.getByRole('checkbox', { name: /^Ireland/ }).uncheck();
  await menu.getByRole('checkbox', { name: /^United States/ }).uncheck();
  for (const box of await menu.locator('input[name="festival-pack"]').all()) {
    if (await box.getAttribute('value') !== 'persian') await box.uncheck();
  }
  await page.keyboard.press('Escape');

  // Listed under the month, once even when both regions keep it, and named in
  // the day panel with where they come from
  const list = page.locator('#month-festivals');
  await expect(list.getByRole('button', { name: /^Christmas Day/ })).toHaveCount(1);
  await expect(list).toContainText('Northern Ireland and Scotland bank holiday');
  await expect(list).toContainText('Yalda');
  await expect(page.locator('#day-panel')).toContainText('Christmas Day (Northern Ireland and Scotland)');
  await list.getByRole('button', { name: /Yalda/ }).click();
  await expect(page.locator('#day-panel .day-greg')).toContainText('Monday 21 December 2026');
  await expect(page.locator(selectedCell)).toBeFocused();

  // Remembered, and in the year's table and the feed
  await page.reload();
  await expect(page.locator('#month-festivals')).toContainText('St Andrew’s Day');
  await page.getByRole('button', { name: 'Year', exact: true }).click();
  await expect(page.locator('#year-festivals')).toContainText('Nowruz');
  await page.locator('#year-view').getByRole('button', { name: 'Add to calendar' }).click();
  const feedUrl = await page.locator('#feed-url').inputValue();
  expect(feedUrl).toMatch(/&festivals=persian&holidays=uk-northern-ireland,uk-scotland$/);
  const feed = await (await page.request.get(feedUrl)).text();
  expect(feed).toContain('SUMMARY:St Andrew’s Day');
  expect(feed).toContain('SUMMARY:Yalda');
  await page.locator('#calendar-dialog').getByRole('button', { name: 'Close' }).click();

  // Unticking turns them off again
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await page.locator('#festivals-button').click();
  await menu.getByLabel('Scotland').uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('#month-festivals')).not.toContainText('St Andrew’s Day');
});

test('keeps the selected day in a sheet along the bottom on phones', async ({ page }) => {
  // Only the chosen names' festivals, so the month's list is short and known
  await page.addInitScript(() => {
    localStorage.setItem('holidays', '');
    localStorage.setItem('festivals', '');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?date=2026-01-23&names=old-norse');
  const sheet = page.locator('#day-panel');
  const toggle = sheet.getByRole('button', { name: 'Details' });
  await expect(sheet.locator('.day-title')).toBeInViewport();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(sheet.locator('.facts')).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(sheet.locator('.facts')).toContainText('Bóndadagur (Þorrablót)');
  // It stays open while picking another day
  await page.locator('#grid-body .cell').first().click();
  await expect(sheet.locator('.facts')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'true');

  await sheet.getByRole('button', { name: 'Copy link to this day' }).focus();
  await page.keyboard.press('Escape');
  await expect(sheet.locator('.facts')).toBeHidden();
  await expect(sheet.getByRole('button', { name: 'Details' })).toBeFocused();

  // Keyboard focus moving back to the page behind folds it, so it can't cover what has focus
  await page.keyboard.press('Enter');
  await expect(sheet.locator('.facts')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#month-festivals .festival-link')).toBeFocused();
  await expect(sheet.locator('.facts')).toBeHidden();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator(selectedCell)).toBeFocused();

  // On wider screens it sits beside the grid, with nothing to open
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect(sheet.getByRole('button', { name: 'Details' })).toBeHidden();
  await expect(sheet.locator('.facts')).toBeVisible();
});

test.describe('when moon data arrives late', () => {
  // The service worker would fetch the moon library itself, out of the route's reach
  test.use({ serviceWorkers: 'block' });

  test('keeps focus on the control in the day panel', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route(/astronomy[^/]*\.js$/, async (route) => {
      await held;
      await route.continue();
    });
    // Firefox counts the held library towards the load event, so don't wait for it
    await page.goto('./?date=2026-10-17&names=anglo-saxon', { waitUntil: 'commit' });
    await page.getByRole('button', { name: 'Copy link to this day' }).focus();
    release();
    // The month draws again with its moon phases
    await expect(page.locator('#grid-body .name', { hasText: /moon/ }).first()).toBeAttached();
    await expect(page.getByRole('button', { name: 'Copy link to this day' })).toBeFocused();
  });
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
  // Names are fitted again once the display font arrives, so allow for that
  await expect.poll(() => page.locator('#almanac thead th').evaluateAll((headers) =>
    headers.filter((th) => th.scrollWidth > th.clientWidth + 1).length)).toBe(0);

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

  // A day that doesn't exist is reported against the day field
  await page.locator('#goto-solar-day').fill('30');
  await page.locator('#goto-solar').getByRole('button', { name: 'Go' }).click();
  await expect(page.locator('#goto-error')).toHaveText('Choose a day from 1 to 28.');
  await expect(page.locator('#goto-solar-day')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#goto-solar-day')).toBeFocused();
});

test('adds the calendar to Google and other calendar apps, or downloads a year', async ({ page }) => {
  await page.goto('./?date=2026-10-17&names=anglo-saxon');
  // From the month view, next to Print month
  await page.locator('#month-view').getByRole('button', { name: 'Add to calendar' }).click();
  const dialog = page.locator('#calendar-dialog');
  await expect(dialog).toBeVisible();

  // The other packs load once the first view is up; the links fill in when they have
  await expect(dialog.locator('#feed-url')).toHaveValue(/&festivals=/);
  const feedUrl = await dialog.locator('#feed-url').inputValue();
  // Every set of public holidays and every other pack's festivals are on by default
  expect(feedUrl).toMatch(/\/feed\.ics\?names=anglo-saxon&festivals=[a-z,-]+&holidays=uk-england-and-wales,uk-northern-ireland,uk-scotland,ireland,us-federal$/);
  expect(new URL(feedUrl).searchParams.get('festivals')!.split(',')).toEqual(['coptic', 'egyptian', 'gaulish', 'old-norse', 'persian', 'roman', 'sky']);
  // Google's add-calendar page gets the feed as a webcal link; Apple and Outlook open it directly
  const webcal = feedUrl.replace(/^https?:/, 'webcal:');
  await expect(dialog.getByRole('link', { name: /^Add to Google Calendar/ })).toHaveAttribute('href', `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`);
  await expect(dialog.getByRole('link', { name: 'Apple Calendar or Outlook' })).toHaveAttribute('href', webcal);

  // The feed is served by the built Worker bundle
  const feed = await page.request.get(feedUrl);
  expect(feed.headers()['content-type']).toBe('text/calendar; charset=utf-8');
  expect(await feed.text()).toContain('X-WR-CALNAME:Solar calendar (Anglo-Saxon)');

  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Download solar 2026 (.ics)' }).click()]);
  expect(download.suggestedFilename()).toBe('solar-calendar-2026-anglo-saxon.ics');
  const chunks: Buffer[] = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(chunk as Buffer);
  const file = Buffer.concat(chunks).toString('utf8');
  expect(file.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(file).toContain('SUMMARY:☀ 13 Winterfylleþ');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  // The year view has the same button
  await page.getByRole('button', { name: 'Year', exact: true }).click();
  await page.locator('#year-view').getByRole('button', { name: 'Add to calendar' }).click();
  await expect(dialog).toBeVisible();
});

test.describe('when the other packs arrive late', () => {
  // The service worker would fetch the packs itself, out of the route's reach
  test.use({ serviceWorkers: 'block' });

  test('fills in Add to calendar once they have', async ({ page }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route(/\/persian-[^/]*\.js$/, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('./?date=2026-10-17&names=anglo-saxon', { waitUntil: 'commit' });
    await page.locator('#month-view').getByRole('button', { name: 'Add to calendar' }).click();
    const feed = page.locator('#feed-url');
    await expect(feed).toHaveValue(/names=anglo-saxon/);
    await expect(feed).not.toHaveValue(/persian/);
    release();
    await expect(feed).toHaveValue(/&festivals=[a-z,-]*persian/);
    await expect(page.getByRole('link', { name: 'Apple Calendar or Outlook' })).toHaveAttribute('href', /persian/);
  });
});

test('serves a badge with today’s solar date', async ({ page }) => {
  // From the built Worker bundle, as on Cloudflare
  const badge = await page.request.get('./today.svg?names=gregorian&tz=Europe/London');
  expect(badge.headers()['content-type']).toBe('image/svg+xml; charset=utf-8');
  expect(await badge.text()).toMatch(/aria-label="Solar calendar: [^"]+ \d{4}"/);
});

test('asks for the location on a first visit, explaining why, with a way to say no', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Location emulation, one project');
  const notice = page.locator('#location-notice');
  await page.goto('./?date=2026-06-21&names=gregorian');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('never sent anywhere');
  await notice.getByRole('button', { name: 'No thanks' }).click();
  await expect(notice).toBeHidden();
  await expect(page.locator('#month-title')).toBeFocused();
  await page.reload();
  await expect(page.locator('#month-name')).toHaveText('June');
  await expect(notice).toBeHidden();

  // Saying yes stores the place, rounded, and shows the times straight away
  await page.evaluate(() => localStorage.removeItem('locationPrompt'));
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });
  await page.reload();
  await notice.getByRole('button', { name: 'Use my location' }).click();
  await expect(notice).toBeHidden();
  await expect(page.locator('#day-panel [data-sun]')).toContainText(/Sunrise 04:4\d, sunset 21:2\d BST/);
  expect(await page.evaluate(() => localStorage.getItem('location'))).toBe('{"lat":51.51,"lon":-0.13}');
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
  // Focus comes back to the button that opened the dialog
  await expect(sun.getByRole('button', { name: 'Change place' })).toBeFocused();

  // Forgetting the location goes back to offering it
  await sun.getByRole('button', { name: 'Change place' }).click();
  await page.locator('#clear-location').click();
  await expect(sun).toHaveText('Add your location');
  await expect(sun.getByRole('button', { name: 'Add your location' })).toBeFocused();
});

test('switches theme between System, Light and Dark, and remembers it', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  const theme = page.getByRole('group', { name: 'Theme' });
  await expect(theme.getByRole('radio', { name: 'System' })).toBeChecked();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await theme.getByLabel('Dark').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(17, 16, 14)');

  // Kept for the next visit, and on the other pages
  await page.goto('./privacy');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('group', { name: 'Theme' }).getByRole('radio', { name: 'Dark' })).toBeChecked();
  await page.getByRole('group', { name: 'Theme' }).getByLabel('System').check();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  expect(await page.evaluate(() => localStorage.getItem('almanac-theme'))).toBe('system');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(251, 247, 240)');
});

test('keeps a theme chosen with the old theme button', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('seen')) { sessionStorage.setItem('seen', '1'); localStorage.setItem('theme', 'dark'); } });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('group', { name: 'Theme' }).getByRole('radio', { name: 'Dark' })).toBeChecked();
  expect(await page.evaluate(() => [localStorage.getItem('theme'), localStorage.getItem('almanac-theme')])).toEqual([null, 'dark']);
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
  // Ink on white, with the accent kept for what means something
  await expect(page.locator('#month-year')).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(page.locator('#month-name')).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(page.locator('[data-theme-switch]')).toBeHidden();
  expect(await pages()).toBe(1);

  // The busiest month for festivals, with every pack and holiday on
  await page.emulateMedia({ media: 'screen' });
  await page.goto('./?date=2026-12-21&names=gregorian');
  await expect(page.locator('#month-festivals li')).not.toHaveCount(0);
  await page.emulateMedia({ media: 'print' });
  expect(await pages()).toBe(1);

  await page.emulateMedia({ media: 'screen' });
  await page.goto('./?view=year&date=2028-06-01&names=anglo-saxon');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#almanac')).toBeVisible();
  expect(await pages()).toBe(1);

  // The legal pages print upright, as reading, without the masthead or footer
  for (const path of LEGAL_PAGES) {
    await page.emulateMedia({ media: 'screen' });
    await page.goto(path);
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    await expect(page.locator('.masthead'), path).toBeHidden();
    await expect(page.locator('.site-footer'), path).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 }), path).toHaveCSS('color', 'rgb(0, 0, 0)');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), path).toBe('rgb(255, 255, 255)');
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    // A4 upright: 595 by 842 points
    const [, width, height] = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf.toString('latin1'))!.map(Number);
    expect([Math.round(width), Math.round(height)], path).toEqual([595, 842]);
  }
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

  /** Serves every response with the policy Cloudflare serves, and records anything it blocks. */
  async function underPolicy(page: Page): Promise<() => Promise<string[]>> {
    // The built _headers, which has the inline theme script's hash in place of
    // the placeholder in public/_headers
    const csp = /Content-Security-Policy: (.+)/.exec(readFileSync('dist/_headers', 'utf8'))![1];
    expect(csp).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/]{43}=' /);
    await page.route('**/*', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });
    await page.addInitScript(() => {
      const blocked: string[] = [];
      (window as unknown as { blocked: string[] }).blocked = blocked;
      document.addEventListener('securitypolicyviolation', (event) => {
        // Newer WebKit reports styles inside its own form controls, such as a
        // <select>; those elements have no style attribute from the app
        if (event.violatedDirective.startsWith('style-src-attr') && !(event.target as Element).hasAttribute?.('style')) return;
        blocked.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });
    return () => page.evaluate(() => (window as unknown as { blocked: string[] }).blocked);
  }

  test('works without anything being blocked', async ({ page }) => {
    const blocked = await underPolicy(page);
    await page.goto('./?date=2026-10-17&names=anglo-saxon');
    await expect(page.locator('#month-name')).toHaveText('Winterfylleþ');
    await expect(page.locator('#day-panel [data-moon]')).not.toHaveText(/^\s*$/);
    await page.locator('#about-name').click();
    await page.goto('./?view=year&date=2026-10-17');
    await expect(page.locator('#almanac td[data-day]')).toHaveCount(364);
    expect(await blocked()).toEqual([]);
    for (const [path, heading] of [['./privacy', 'Privacy policy'], ['./terms', 'Terms of use'], ['./disclaimer', 'Disclaimer']]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      expect(await blocked(), path).toEqual([]);
    }
    // Font requests can still be in flight; let them finish unintercepted
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  // The saved choice has to win over the system setting before anything paints,
  // so the inline script must run, under the policy, before <body> is parsed
  // almanac-theme is the design kit's switch; theme is the older button's, moved across on load
  for (const [saved, system, key] of [['dark', 'light', 'almanac-theme'], ['light', 'dark', 'almanac-theme'], ['dark', 'light', 'theme']] as const) {
    test(`applies a saved ${saved} theme (${key}) before the first paint, on every page`, async ({ page }) => {
      const blocked = await underPolicy(page);
      await page.emulateMedia({ colorScheme: system });
      await page.addInitScript(([theme, name]) => {
        localStorage.setItem(name, theme);
        const seen = window as unknown as { themeAtBody?: string | null };
        new MutationObserver((_, observer) => {
          if (!document.body) return;
          seen.themeAtBody = document.documentElement.dataset.theme ?? null;
          observer.disconnect();
        }).observe(document, { childList: true, subtree: true });
      }, [saved, key]);
      for (const path of ['./', './privacy', './terms', './disclaimer']) {
        await page.goto(path);
        expect(await page.evaluate(() => (window as unknown as { themeAtBody?: string | null }).themeAtBody), path).toBe(saved);
        await expect(page.locator('html'), path).toHaveAttribute('data-theme', saved);
      }
      expect(await blocked()).toEqual([]);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  }
});

test.describe('when the fonts arrive late', () => {
  // The service worker would fetch the fonts itself, out of the route's reach
  test.use({ serviceWorkers: 'block' });

  test('barely moves the page as the kit’s typefaces replace their fallbacks', async ({ page }, testInfo) => {
    test.skip(!['chromium', 'phone'].includes(testInfo.project.name), 'Only Chromium reports layout shifts');
    // A common phone width, and a desktop width. Chrome on Linux draws text at
    // whole pixel sizes, so size-adjust lands a little off there, and a line
    // that only just fits can still wrap differently
    await page.setViewportSize(testInfo.project.name === 'phone' ? { width: 390, height: 844 } : { width: 1024, height: 800 });
    await page.route(/\.woff2$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.addInitScript(() => {
      const seen = window as unknown as { layoutShift: number };
      seen.layoutShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!entry.hadRecentInput) seen.layoutShift += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const loaded = (family: string) => page.evaluate((name) => [...document.fonts].some((face) => face.family === name && face.status === 'loaded'), family);

    // Fonts asked for before the load event hold it up, so don't wait for it
    await page.goto('./?date=2026-10-17', { waitUntil: 'commit' });
    await expect(page.locator('#today-line')).toContainText('Today is');
    // The reshaped Arial and Times New Roman (Liberation Sans and Serif on Linux)
    // stand in while Schibsted Grotesk and Libre Caslon load
    await expect.poll(() => loaded('Schibsted Grotesk Fallback Arial')).toBe(true);
    await expect.poll(() => loaded('Libre Caslon Text Fallback Times New Roman')).toBe(true);
    expect(await loaded('Schibsted Grotesk')).toBe(false);
    await expect.poll(() => loaded('Schibsted Grotesk'), { timeout: 10_000 }).toBe(true);
    await expect.poll(() => loaded('Libre Caslon Text'), { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as { layoutShift: number }).layoutShift)).toBeLessThan(0.1);
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

const LEGAL_PAGES = ['./privacy', './terms', './disclaimer'];

test('links to the privacy policy, terms, disclaimer, source code and the main site from every page', async ({ page }) => {
  await page.goto('./');
  // The wordmark always leads back to the main site
  await expect(page.locator('.masthead').getByRole('link', { name: 'Tom Gould.' })).toHaveAttribute('href', 'https://www.dealmobile.co.uk/');
  const footer = page.locator('.site-footer');
  await expect(footer.getByRole('link', { name: 'Source code on GitHub' })).toHaveAttribute('href', 'https://github.com/tomgould/solar-calendar');
  await expect(footer.getByRole('link', { name: 'About this project' })).toHaveAttribute('href', 'https://www.dealmobile.co.uk/projects/solar-calendar');
  await expect(footer.getByRole('link', { name: 'Tom Gould' })).toHaveAttribute('href', 'https://www.dealmobile.co.uk/');
  // Each page has the same footer, and a way back to the calendar
  for (const [link, heading] of [['Privacy policy', 'Privacy policy'], ['Terms of use', 'Terms of use'], ['Disclaimer', 'Disclaimer']]) {
    await footer.getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page).toHaveTitle(`${heading}, Solar calendar`);
    await expect(footer.getByRole('link')).toHaveCount(6);
    await expect(page.locator('.masthead').getByRole('link', { name: 'Tom Gould.' })).toHaveAttribute('href', 'https://www.dealmobile.co.uk/');
    await page.getByRole('link', { name: 'Back to the calendar' }).click();
    await expect(page.locator('#today-line')).toContainText('Today is');
  }
  // The first-visit location notice links to the privacy policy too
  await expect(page.locator('#location-notice').getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', './privacy');
});

test('lists every page in sitemap.xml at its canonical address, and robots.txt names it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Checks served files, one project');
  const robots = await page.request.get('./robots.txt');
  expect(robots.headers()['content-type']).toMatch(/^text\/plain/);
  expect(await robots.text()).toMatch(/^Sitemap: https:\/\/solar\.dealmobile\.co\.uk\/sitemap\.xml$/m);

  const sitemap = await page.request.get('./sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toMatch(/xml/);
  const xml = await sitemap.text();
  const canonicals: (string | null)[] = [];
  for (const path of ['./', ...LEGAL_PAGES]) {
    await page.goto(path);
    canonicals.push(await page.locator('link[rel="canonical"]').getAttribute('href'));
  }
  // It parses as XML, in the sitemap namespace
  const entries = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) return null;
    const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
    return [...doc.getElementsByTagNameNS(ns, 'url')].map((url) =>
      [url.getElementsByTagNameNS(ns, 'loc')[0]?.textContent, url.getElementsByTagNameNS(ns, 'lastmod')[0]?.textContent]);
  }, xml);
  expect(entries?.map(([loc]) => loc)).toEqual(canonicals);
  for (const [, lastmod] of entries!) expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('describes itself to search engines, with one h1 at a time', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#today-line')).toContainText('Today is');
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(data['@graph'].map((thing: { '@type': string }) => thing['@type'])).toEqual(['WebApplication', 'WebSite', 'Person']);
  // The page's own title stays while today's month is on screen
  await expect(page).toHaveTitle('Solar Calendar: 13 months of 28 days');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveId('month-title');

  // The year's heading takes over as the h1, looking just the same
  const monthSize = await page.locator('#month-title').evaluate((heading) => getComputedStyle(heading).fontSize);
  await page.locator('[data-view="year"]').click();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveId('year-title');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Solar year \d{4}$/);
  expect(await page.locator('#year-title').evaluate((heading) => getComputedStyle(heading).fontSize)).toBe(monthSize);
  await expect(page).toHaveTitle(/, solar calendar$/);

  await page.locator('[data-view="month"]').click();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveId('month-title');
  await expect(page.locator('#month-name')).not.toBeEmpty();
  await page.locator('#next-month').click();
  await expect(page).toHaveTitle(/, solar calendar$/);
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
    for (const path of [...LEGAL_PAGES, './404.html']) {
      await page.goto(path);
      await check(`${path}, ${colorScheme}`);
    }
  }
  // The narrowest phone, and 400% zoom
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('./?date=2026-10-17&names=anglo-saxon');
  await check('month view at 320 px');
});

test('fits every width from 320 px to 1920, a phone on its side, and 200% and 400% zoom', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Sizes are set here, one project');
  // 640 and 320 px are a 1280 px screen at 200% and 400% zoom (WCAG 1.4.10, reflow)
  const sizes = [[320, 640], [375, 812], [390, 844], [640, 400], [768, 1024], [844, 390], [1024, 768], [1440, 900], [1920, 1080]];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const path of ['./?date=2026-12-21&names=anglo-saxon', './?view=year', ...LEGAL_PAGES, './404.html']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      const where = `${path} at ${width} by ${height}`;
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), where).toBeLessThanOrEqual(0);
      // The masthead's links and controls stay on screen
      for (const box of await page.locator('.masthead a, .masthead button, .masthead label').evaluateAll((elements) =>
        elements.filter((element) => element.getClientRects().length > 0).map((element) => element.getBoundingClientRect().right))) {
        expect(box, where).toBeLessThanOrEqual(width);
      }
    }
  }
});

test('keeps today, the selected day and pressed buttons visible in Windows high contrast', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'forced-colors emulation is Chromium only');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('./');
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // Today is selected when the calendar opens: outlined, and its numeral on the system highlight
  await expect(page.locator(selectedCell)).toHaveCSS('outline-style', 'solid');
  expect(await page.locator('#grid-body [aria-current="date"] .num').evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(background);
  const [pressed, unpressed] = await Promise.all(['true', 'false'].map((value) =>
    page.locator(`.segmented button[aria-pressed="${value}"]`).evaluate((element) => getComputedStyle(element).backgroundColor)));
  expect(pressed).not.toBe(unpressed);
  // Pills keep an edge, as their outline is a shadow the system removes
  await expect(page.locator('#print-month')).toHaveCSS('border-top-style', 'solid');
});

test('follows reduced motion and more contrast', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Media emulation, one project');
  await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' });
  await page.goto('./?date=2026-10-17&names=gregorian');
  await expect(page.locator('.strip .bar').first()).toHaveCSS('transition-duration', '0s');
  // Muted text takes the stronger ink
  const inkSoft = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ink-soft').trim());
  expect(inkSoft).toBe('#2d2820');
  await expect(page.locator('.greg').nth(3)).toHaveCSS('color', 'rgb(45, 40, 32)');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('says why, hides what can’t work, and keeps the footer’s links', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.noscript')).toBeVisible();
    await expect(page.locator('.noscript')).toBeInViewport();
    await expect(page.locator('#main')).toBeHidden();
    await expect(page.locator('.controls')).toBeHidden();
    await expect(page.locator('[data-theme-switch]')).toBeHidden();
    await expect(page.locator('.site-footer').getByRole('link', { name: 'Privacy policy' })).toBeVisible();
    await page.goto('./privacy');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
    await expect(page.locator('[data-theme-switch]')).toBeHidden();
  });
});

test('has a page for missing addresses, in the calendar’s style', async ({ page }) => {
  // Cloudflare serves it for any missing path (not_found_handling); vite preview doesn't
  expect(readFileSync('wrangler.jsonc', 'utf8')).toMatch(/"not_found_handling": "404-page"/);
  await page.goto('./404.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  // Absolute, since it can be served at any depth
  await expect(page.getByRole('link', { name: 'Open the calendar' })).toHaveAttribute('href', '/');
  await expect(page.locator('link[rel="stylesheet"]').first()).toHaveAttribute('href', /^\/assets\//);
});

test('never scrolls the page sideways', async ({ page }) => {
  for (const path of ['./', './?view=year', ...LEGAL_PAGES]) {
    await page.goto(path);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sideways, path).toBeLessThanOrEqual(0);
  }
});
