// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Solar Calendar - Main Pages', () => {
  test('should load the solar calendar page', async ({ page }) => {
    await page.goto('/solar-calendar.html');
    await expect(page).toHaveTitle(/Solar|Calendar/i);
  });

  test('should load the gregorian calendar page', async ({ page }) => {
    await page.goto('/gregorian-calendar.html');
    await expect(page).toHaveTitle(/Gregorian|Calendar/i);
  });
});

test.describe('Solar Calendar - PHP API', () => {
  test('should return valid date conversion', async ({ request }) => {
    const response = await request.get('/RealTime.php');
    expect(response.ok()).toBeTruthy();
    const text = await response.text();
    expect(text).toContain('Year');
    expect(text).toContain('Month');
    expect(text).toContain('Day');
  });
});

test.describe('Solar Calendar - 371-day years', () => {
  // Solar 2028 runs 2028-03-20 to 2029-03-25; the days after Year Day used to recurse forever
  test('gregorian page renders the days after Year Day', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/gregorian-calendar.html?date=2029-03-21');
    await expect(page.locator('.month.active [data-gregorian-date="2029-03-21"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('solar page loads when linked to a day after Year Day', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/solar-calendar.html?date=2029-03-21&year=2029');
    await expect(page.locator('.month.active')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Solar Calendar - UI Elements', () => {
  test('should display calendar grid', async ({ page }) => {
    await page.goto('/solar-calendar.html');
    await expect(page.locator('body')).toBeVisible();
  });
});
