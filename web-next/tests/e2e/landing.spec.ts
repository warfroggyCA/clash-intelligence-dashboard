import { test, expect } from '@playwright/test';

const GENERIC_HOST = process.env.PLAYWRIGHT_APEX_HOST || 'http://localhost:5050';
const CLAN_HOST = process.env.PLAYWRIGHT_CLAN_HOST || 'http://heckyeah.localhost:5050';

const genericHeroCopy = 'The war room for modern clans in Clash of Clans.';

test.describe('Landing pages', () => {
  test('generic marketing hero and CTA', async ({ page }) => {
    await page.goto(GENERIC_HOST, { waitUntil: 'networkidle' });
    await expect(page.getByText(genericHeroCopy)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request Access' })).toHaveAttribute('href', 'mailto:info@clashintelligence.com');
  });

  test('clan host shows welcome banner and Clash Display font', async ({ page }) => {
    await page.goto(CLAN_HOST, { waitUntil: 'networkidle' });
    await expect(page.getByText('Serving the HeckYeah deployment')).toBeVisible();
    await expect(page.getByText('Welcome to HeckYeah')).toBeVisible();
  });
});

