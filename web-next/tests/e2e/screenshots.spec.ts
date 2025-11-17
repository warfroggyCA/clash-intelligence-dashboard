import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const APEX_HOST = process.env.PLAYWRIGHT_APEX_HOST || 'http://localhost:5050';
const CLAN_HOST = process.env.PLAYWRIGHT_CLAN_HOST || 'http://heckyeah.localhost:5050';
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || 'do.ugfindlay@gmail.com';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || 'testuser';

// Ensure screenshot directories exist
const screenshotDirs = [
  'docs/assets/dashboard',
  'docs/assets/login',
  'docs/assets/onboarding',
];

screenshotDirs.forEach((dir) => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

async function signIn(page) {
  await page.goto(`${CLAN_HOST}/login`);
  await page.getByLabel('Email address').fill(TEST_EMAIL);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/app', { timeout: 10_000 }).catch(() => {});
  try {
    await page.waitForSelector('h3:has-text("Quick Actions")', { 
      timeout: 10_000,
      state: 'visible'
    });
  } catch {
    await page.waitForTimeout(3000);
  }
}

async function signOut(page) {
  await page.goto(`${CLAN_HOST}/api/logout`, { method: 'POST' }).catch(() => {});
  await page.waitForTimeout(1000);
}

test.describe('Screenshot Capture for SYSTEM_MANUAL.md', () => {
  test('capture all dashboard screenshots', async ({ page }) => {
    // Set consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Sign in first
    await signIn(page);

    // 4.1 Main Dashboard
    await page.goto(`${CLAN_HOST}/app`);
    await page.waitForSelector('h3:has-text("Quick Actions")', { state: 'visible' });
    await page.waitForTimeout(2000); // Wait for content to load
    await page.screenshot({ 
      path: 'docs/assets/dashboard/dashboard-home.png',
      fullPage: true 
    });

    // 4.1 Quick Actions inset (optional)
    const quickActions = page.locator('h3:has-text("Quick Actions")').first();
    if (await quickActions.isVisible()) {
      await quickActions.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: 'docs/assets/dashboard/quick-actions.png',
        clip: { x: 0, y: 0, width: 1280, height: 400 }
      });
    }

    // 4.2 War Planning
    await page.goto(`${CLAN_HOST}/war`);
    await page.waitForTimeout(3000); // Wait for war plan to load
    await page.screenshot({ 
      path: 'docs/assets/dashboard/war-planning.png',
      fullPage: true 
    });

    // Discord brief builder (from war page)
    try {
      const discordTab = page.locator('button, [role="tab"]').filter({ hasText: /discord/i }).first();
      if (await discordTab.isVisible({ timeout: 2000 })) {
        await discordTab.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: 'docs/assets/dashboard/discord-brief.png',
          fullPage: true 
        });
      }
    } catch {
      // Discord tab not found, skip
    }

    // 4.3 Settings – Active Access
    await page.goto(`${CLAN_HOST}/settings`);
    await page.waitForTimeout(2000);
    // Scroll to Active Access section if needed
    const activeAccess = page.getByText(/Active access/i);
    if (await activeAccess.isVisible()) {
      await activeAccess.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ 
      path: 'docs/assets/dashboard/settings-active-access.png',
      fullPage: true 
    });

    // Settings – Tracked Clans (scroll down)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'docs/assets/dashboard/settings-tracked-clans.png',
      fullPage: true 
    });

    // 4.4 Player Profile
    await page.goto(`${CLAN_HOST}/player/%23JL2RPU09`);
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'docs/assets/dashboard/player-profile.png',
      fullPage: true 
    });

    // Quick Actions → Ingestion Monitor
    await page.goto(`${CLAN_HOST}/app`);
    await page.waitForTimeout(1000);
    try {
      const ingestionButton = page.locator('button, a').filter({ hasText: /ingestion/i }).first();
      if (await ingestionButton.isVisible({ timeout: 2000 })) {
        await ingestionButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: 'docs/assets/dashboard/ingestion-monitor.png',
          fullPage: true 
        });
        // Close modal if needed
        await page.keyboard.press('Escape').catch(() => {});
      }
    } catch {
      // Ingestion button not found, skip
    }
  });

  test('capture landing page screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // 4.5 Generic Landing
    await page.goto(APEX_HOST);
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'docs/assets/dashboard/landing-generic.png',
      fullPage: true 
    });

    // 4.5 Clan Landing
    await page.goto(CLAN_HOST);
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'docs/assets/dashboard/landing-heckyeah.png',
      fullPage: true 
    });
  });

  test('capture login screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Login – Generic
    await page.goto(`${APEX_HOST}/login`);
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'docs/assets/login/login-generic.png',
      fullPage: true 
    });

    // Login – Clan
    await page.goto(`${CLAN_HOST}/login`);
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'docs/assets/login/login-clan.png',
      fullPage: true 
    });
  });

  test('capture onboarding screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Onboarding guard (signed out)
    await signOut(page);
    await page.goto(`${CLAN_HOST}/onboarding`);
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'docs/assets/onboarding/onboarding-signin.png',
      fullPage: true 
    });

    // Sign in and check onboarding state
    await signIn(page);
    await page.goto(`${CLAN_HOST}/onboarding`);
    await page.waitForTimeout(2000);

    // Check if already onboarded
    const alreadyOnboarded = await page.getByText(/already onboarded/i).isVisible().catch(() => false);
    if (alreadyOnboarded) {
      await page.screenshot({ 
        path: 'docs/assets/onboarding/onboarding-already.png',
        fullPage: true 
      });
    } else {
      // Onboarding form
      const formVisible = await page.getByText(/Set up your clan access/i).isVisible().catch(() => false);
      if (formVisible) {
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: 'docs/assets/onboarding/onboarding-form.png',
          fullPage: true 
        });

        // Try to complete onboarding to get success state
        try {
          const card = page.locator('button, [role="button"]').filter({ hasText: /TH\s+\d+/ }).first();
          if (await card.isVisible({ timeout: 2000 })) {
            await card.click();
            await page.waitForTimeout(500);
            const completeButton = page.getByRole('button', { name: /Complete onboarding/i });
            if (await completeButton.isVisible({ timeout: 2000 })) {
              await completeButton.click();
              await page.waitForTimeout(2000);
              await page.screenshot({ 
                path: 'docs/assets/onboarding/onboarding-success.png',
                fullPage: true 
              });
            }
          }
        } catch {
          // Couldn't complete onboarding, that's ok
        }
      }
    }

    // AuthGate onboarding prompt (navigate away then back)
    await page.goto(`${CLAN_HOST}/app`);
    await page.waitForTimeout(1000);
    // Check if AuthGate shows onboarding prompt
    const authGatePrompt = await page.getByText(/Finish onboarding/i).isVisible().catch(() => false);
    if (authGatePrompt) {
      await page.screenshot({ 
        path: 'docs/assets/onboarding/authgate-onboarding.png',
        fullPage: true 
      });
    }
  });
});

