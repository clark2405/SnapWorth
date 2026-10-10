import { expect, test } from '@playwright/test';

// The web app on preview data: what a visitor sees and can do, end to end in a real browser.
// Run against a dev server: `npm run dev`, then `npm run test:browser`.

test('the feed opens on the wordmark, what is hot and the newest posts', async ({ page }) => {
  await page.goto('/feed');

  await expect(page.getByRole('img', { name: 'SnapWorth' }).first()).toBeVisible();
  await expect(page.getByText('Hot this month')).toBeVisible();
  await expect(page.getByText('@retro_curator').first()).toBeVisible();
});

test('a listing photo opens full screen and closes again', async ({ page }) => {
  await page.goto('/listing/polaroid-sun-600');

  await page
    .getByRole('button', { name: /full screen/i })
    .first()
    .click();
  await expect(page.getByText('1 of 2')).toBeVisible();

  await page.getByRole('button', { name: /close/i }).first().click();
  await expect(page.getByText('1 of 2')).toBeHidden();
});

test('sharing a listing copies a link to it where the browser has no share sheet', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Clipboard permissions are a Chromium feature here.');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  await page.goto('/listing/polaroid-sun-600');

  await page.getByRole('button', { name: 'Share this listing' }).click();

  await expect(page.getByText('Link copied')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/\/listing\/polaroid-sun-600$/);
});

test('notification choices are still there after a reload', async ({ page }) => {
  await page.goto('/settings/notifications');
  const offers = page.getByRole('switch', { name: 'Offers' });
  await expect(offers).toBeChecked();

  await offers.click();
  await expect(offers).not.toBeChecked();
  await page.reload();

  await expect(page.getByRole('switch', { name: 'Offers' })).not.toBeChecked();
});

test('help opens an answer in place', async ({ page }) => {
  await page.goto('/settings/help');

  await page.getByRole('button', { name: 'How many photos can a listing have?' }).click();

  await expect(page.getByText(/Up to four: the cover and three more/)).toBeVisible();
});
