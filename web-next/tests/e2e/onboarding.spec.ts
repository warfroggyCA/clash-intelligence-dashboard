import { test, expect } from '@playwright/test';

const CLAN_HOST = process.env.PLAYWRIGHT_CLAN_HOST || 'http://heckyeah.localhost:5050';

test('onboarding route prompts unauthenticated users to sign in', async ({ page }) => {
  await page.goto(`${CLAN_HOST}/onboarding`);
  await expect(page.getByText('Sign In Required')).toBeVisible();
});
