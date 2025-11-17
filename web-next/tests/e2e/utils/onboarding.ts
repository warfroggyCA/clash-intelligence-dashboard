import type { Page, Locator } from '@playwright/test';

export type OnboardingState = 'form' | 'already' | 'success';

async function isVisible(locator: Locator): Promise<boolean> {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

export async function waitForOnboardingState(page: Page, timeout = 30000): Promise<OnboardingState> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    // Check for "Sign In Required" state - this means session hasn't hydrated yet
    // Wait for it to transition to authenticated state
    const signInRequired = await isVisible(page.getByText(/Sign In Required/i));
    if (signInRequired) {
      // Session is still hydrating, wait a bit and check again
      await page.waitForTimeout(1000);
      continue;
    }

    // Check for form state - heading with "Set up your clan access"
    if (await isVisible(page.getByRole('heading', { name: /Set up your clan access/i }))) {
      return 'form';
    }
    // Check for already onboarded - handle HTML entities and various text matching
    const alreadyOnboardedSelectors = [
      page.getByText("You're already onboarded"),
      page.getByText(/You'?re already onboarded/i),
      page.getByText(/already onboarded/i),
      page.locator('h1:has-text("already onboarded")'),
      page.locator('h1:has-text(/already onboarded/i)'),
    ];
    for (const selector of alreadyOnboardedSelectors) {
      if (await isVisible(selector)) {
        return 'already';
      }
    }
    // Check for success state - handle HTML entities
    if (
      (await isVisible(page.getByText("You're all set"))) ||
      (await isVisible(page.getByText(/You'?re all set/i)))
    ) {
      return 'success';
    }
    // Check for loading states - these are expected during session hydration
    const checkingSession = await isVisible(page.getByText(/Checking your session/i));
    const checkingAccess = await isVisible(page.getByText(/Checking access/i));
    if (checkingSession || checkingAccess) {
      // Still loading, wait a bit more
      await page.waitForTimeout(500);
      continue;
    }
    await page.waitForTimeout(200);
  }

  // Before throwing, log what we actually see on the page
  const bodyText = await page.textContent('body').catch(() => '');
  throw new Error(`Timed out waiting for onboarding state to render. Page content: ${bodyText.substring(0, 200)}`);
}
