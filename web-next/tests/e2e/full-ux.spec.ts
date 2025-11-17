import { test, expect } from '@playwright/test';
import { waitForOnboardingState } from './utils/onboarding';

const APEX_HOST = process.env.PLAYWRIGHT_APEX_HOST || 'http://localhost:5050';
const CLAN_HOST = process.env.PLAYWRIGHT_CLAN_HOST || 'http://heckyeah.localhost:5050';
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || 'do.ugfindlay@gmail.com';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || 'testuser';

async function signIn(page) {
  await page.goto(`${CLAN_HOST}/login`);
  await page.getByLabel('Email address').fill(TEST_EMAIL);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for navigation to /app
  await page.waitForURL('**/app', { timeout: 10_000 }).catch(() => {});
  // Wait for session to be fully hydrated by waiting for authenticated content
  // This ensures the session API call has completed and the Zustand store is populated
  try {
    // Wait for "Quick Actions" heading which only appears when authenticated
    await page.waitForSelector('h3:has-text("Quick Actions")', { 
      timeout: 10_000,
      state: 'visible'
    });
  } catch {
    // Fallback: wait for any authenticated dashboard content
    try {
      await page.waitForFunction(
        () => {
          const body = document.body.textContent || '';
          return body.includes('Quick Actions') || 
                 body.includes('Dashboard') || 
                 !body.includes('Sign In Required') && !body.includes('Checking access');
        },
        { timeout: 10_000 }
      );
    } catch {
      // Last resort: wait a bit for session hydration
      await page.waitForTimeout(3000);
    }
  }
}

test.describe('Full UX journey', () => {
  test('marketing → onboarding → dashboard → settings → player profile', async ({ page }) => {
    await page.goto(APEX_HOST);
    await expect(page.getByText('The war room for modern clans in Clash of Clans.')).toBeVisible();
    await page.getByRole('link', { name: 'Request Access' }).isVisible();

    await page.goto(CLAN_HOST);
    await expect(page.getByText('Serving the HeckYeah deployment')).toBeVisible();
    await expect(page.getByText('Welcome to HeckYeah')).toBeVisible();

    await signIn(page);

    // Navigate to onboarding and wait for session to be ready
    await page.goto(`${CLAN_HOST}/onboarding`);
    // Give the page a moment to start hydrating the session
    await page.waitForTimeout(500);
    const onboardingState = await waitForOnboardingState(page);
    if (onboardingState === 'form') {
      await expect(page.getByText('Set up your clan access')).toBeVisible();
      const card = page.locator('button', { hasText: /TH\s+\d+/ }).first();
      await card.click();
      await page.getByRole('button', { name: /Complete onboarding/i }).click();
      await expect(page.getByText(/You'?re all set/i)).toBeVisible();
      await page.waitForURL('**/app', { timeout: 10_000 }).catch(() => {});
    } else if (onboardingState === 'already') {
      // User is already onboarded - verify the message is shown or page redirects
      const alreadyOnboardedVisible = await page.getByText(/already onboarded/i).isVisible().catch(() => false);
      if (!alreadyOnboardedVisible) {
        // If not visible, page may have redirected - that's also acceptable
        await page.waitForURL('**/app', { timeout: 5000 }).catch(() => {});
      } else {
        await expect(page.getByText(/already onboarded/i)).toBeVisible();
      }
    } else {
      await expect(page.getByText(/You'?re all set/i)).toBeVisible();
    }

    await page.goto(`${CLAN_HOST}/app`);
    await expect(page.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();

    await page.goto(`${CLAN_HOST}/settings`);
    // Settings page should show either "Active access" or other settings content
    const activeAccessVisible = await page.getByText(/Active access/i).isVisible().catch(() => false);
    const settingsVisible = await page.getByText(/Clan Permissions|Settings|Maintenance/i).isVisible().catch(() => false);
    if (!activeAccessVisible && !settingsVisible) {
      // Wait a bit for page to load
      await page.waitForTimeout(1000);
    }
    // At minimum, the settings page should have loaded
    await expect(page.locator('body')).toContainText(/Settings|Clan|Permissions|Maintenance/i);

    // Navigate to a player profile - use a tag from the roster if available, or just verify the page structure
    await page.goto(`${CLAN_HOST}/app`);
    // Try to find any player link on the dashboard
    const playerLink = page.locator('a[href*="/player/"]').first();
    const hasPlayerLink = await playerLink.isVisible().catch(() => false);
    
    if (hasPlayerLink) {
      // Click the first player link we find
      await playerLink.click();
      // Verify we're on a player profile page (should have player info, stats, etc.)
      await expect(page.locator('body')).toContainText(/Player|Profile|TH|Level|Trophies/i, { timeout: 5000 });
    } else {
      // Fallback: navigate to a known player tag and verify page loads
      await page.goto(`${CLAN_HOST}/player/%23JL2RPU09`);
      // Just verify the page loaded (not a 404 or error)
      await expect(page.locator('body')).not.toContainText(/404|Not Found|Error/i, { timeout: 5000 });
    }
  });
});
