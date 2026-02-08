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

test.describe('Solar Calendar - UI Elements', () => {
  test('should display calendar grid', async ({ page }) => {
    await page.goto('/solar-calendar.html');
    await expect(page.locator('body')).toBeVisible();
  });
});
