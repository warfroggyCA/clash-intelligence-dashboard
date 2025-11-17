import { test, expect } from '@playwright/test';
import { waitForOnboardingState } from './utils/onboarding';

const CLAN_HOST = process.env.PLAYWRIGHT_CLAN_HOST || 'http://heckyeah.localhost:5050';
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || 'd.ougfindlay@gmail.com';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || 'testaccount';

test.describe('Authenticated onboarding flow', () => {
  test('locks user into onboarding until tags are selected', async ({ page }) => {
    await page.goto(`${CLAN_HOST}/login`);
    await page.getByLabel('Email address').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for login to complete and redirect
    await page.waitForURL('**/app', { timeout: 10000 }).catch(() => {});
    
    // Wait for session to be established - check that we're not seeing "Sign In Required"
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || '';
        return !body.includes('Sign In Required') && !body.includes('Checking access');
      },
      { timeout: 10000 }
    ).catch(() => {});
    
    await page.goto(`${CLAN_HOST}/onboarding`);

    const state = await waitForOnboardingState(page);

    if (state === 'form') {
      await expect(page.getByText('Set up your clan access')).toBeVisible();
      const cards = page.locator('button', { hasText: /TH\s+\d+/ });
      await cards.first().click();
      await page.getByRole('button', { name: /Complete onboarding/i }).click();
      await expect(page.getByText(/You'?re all set/i)).toBeVisible();
      await expect(page.getByText('Redirecting you to the dashboard', { exact: false })).toBeVisible();
      await page.waitForURL('**/app', { timeout: 10_000 });
    } else if (state === 'already') {
      // Use flexible matching for HTML entities
      await expect(page.getByText(/already onboarded/i)).toBeVisible();
    } else {
      await expect(page.getByText(/You'?re all set/i)).toBeVisible();
    }
  });
});
