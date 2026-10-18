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
      document.addEventListener('securitypolicyviolation', (event) => {
        // Newer WebKit reports styles inside its own form controls, such as a
        // <select>; those elements have no style attribute from the app
        if (event.violatedDirective.startsWith('style-src-attr') && !(event.target as Element).hasAttribute?.('style')) return;
        blocked.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
    });

    await page.goto('./?date=2026-10-17&names=anglo-saxon');
    await expect(page.locator('#month-name')).toHaveText('Winterfylleþ');
    await expect(page.locator('#day-panel [data-moon]')).not.toHaveText(/^\s*$/);
    await page.locator('#about-name').click();
    await page.goto('./?view=year&date=2026-10-17');
    await expect(page.locator('#almanac td[data-day]')).toHaveCount(364);
    expect(await page.evaluate(() => (window as unknown as { blocked: string[] }).blocked)).toEqual([]);
    await page.goto('./privacy');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
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

const LEGAL_PAGES = ['./privacy', './terms', './disclaimer'];

test('links to the privacy policy, terms, disclaimer, source code and other projects from every page', async ({ page }) => {
  await page.goto('./');
  const footer = page.locator('.site-footer');
  await expect(footer.getByRole('link', { name: 'Source code on GitHub' })).toHaveAttribute('href', 'https://github.com/tomgould/solar-calendar');
  await expect(footer.getByRole('link', { name: 'More projects from Deal Mobile' })).toHaveAttribute('href', 'https://www.dealmobile.co.uk');
  // Each page has the same footer, and a way back to the calendar
  for (const [link, heading] of [['Privacy policy', 'Privacy policy'], ['Terms of use', 'Terms of use'], ['Disclaimer', 'Disclaimer']]) {
    await footer.getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page).toHaveTitle(`${heading}, Solar calendar`);
    await expect(footer.getByRole('link')).toHaveCount(5);
    await page.getByRole('link', { name: 'Back to the calendar' }).click();
    await expect(page.locator('#today-line')).toContainText('Today is');
  }
  // The first-visit location notice links to the privacy policy too
  await expect(page.locator('#location-notice').getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', './privacy');
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
    for (const path of LEGAL_PAGES) {
      await page.goto(path);
      await check(`${path}, ${colorScheme}`);
    }
  }
});

test('never scrolls the page sideways', async ({ page }) => {
  for (const path of ['./', './?view=year', ...LEGAL_PAGES]) {
    await page.goto(path);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sideways, path).toBeLessThanOrEqual(0);
  }
});
