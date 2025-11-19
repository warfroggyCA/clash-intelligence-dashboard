import { test, expect } from '@playwright/test';

const GENERIC_HOST = process.env.PLAYWRIGHT_APEX_HOST || 'http://localhost:5050';
const CLAN_HOST = process.env.PLAYWRIGHT_CLAN_HOST || 'http://heckyeah.localhost:5050';

test.describe('Login flows', () => {
  test('generic login advises using clan portal', async ({ page }) => {
    await page.goto(`${GENERIC_HOST}/login`);
    await expect(page.getByText('Choose your clan landing page')).toBeVisible();
    await expect(page.getByText('info@clashintelligence.com')).toBeVisible();
  });

  test('clan login shows access form', async ({ page }) => {
    await page.goto(`${CLAN_HOST}/login`);
    await expect(page.getByText('Clan Access Portal')).toBeVisible();
    await expect(page.getByLabel('Email or Username')).toBeVisible();
  });
});
