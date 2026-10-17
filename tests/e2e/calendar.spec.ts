import { test as base, expect } from '@playwright/test';

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
  await page.goto('./?date=2026-03-23&names=original');
  await expect(page.locator('#month-name')).toHaveText('March');
  await expect(page.locator(selectedCell)).toHaveAttribute('aria-label', /^1 March 2026, Monday 23 March 2026/);

  await page.goto('./?date=2026-10-17&names=original');
  await expect(page.locator(selectedCell)).toHaveAttribute('aria-label', /^13 October 2026, Saturday 17 October 2026/);
});

test('moves by day, week and month with the keyboard', async ({ page }) => {
  await page.goto('./?date=2026-10-17&names=anglo-saxon');
  await page.locator(selectedCell).focus();
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown']) await page.keyboard.press(key);
  await expect(page).toHaveURL(/date=2026-10-26/);
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^22 Winterfylleþ 2026/);

  await page.keyboard.press('PageDown');
  await expect(page).toHaveURL(/date=2026-11-23/);
  await expect(page.locator('#month-name')).toHaveText('Blōtmōnaþ');
});

test('switches month names and remembers the choice', async ({ page }) => {
  await page.goto('./?date=2026-10-17&names=original');
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
  await page.goto('./?date=2029-03-21&names=original');
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

  await page.goto('./?view=year&date=2028-06-01&names=original');
  await expect(page.locator('#almanac td[data-day]')).toHaveCount(371);
});

test('never scrolls the page sideways', async ({ page }) => {
  for (const path of ['./', './?view=year']) {
    await page.goto(path);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sideways, path).toBeLessThanOrEqual(0);
  }
});
