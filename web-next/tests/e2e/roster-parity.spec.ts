import { test, expect, type Page } from '@playwright/test';

const HERO_ALT_SELECTOR = [
  'img[alt="Barbarian King"]',
  'img[alt="Archer Queen"]',
  'img[alt="Grand Warden"]',
  'img[alt="Royal Champion"]',
  'img[alt="Minion Prince"]',
].join(', ');

async function hasVisibleEyebrow(page: Page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('div'));
    return nodes.some((node) => {
      const el = node as HTMLElement;
      return el.textContent?.trim() === 'Players → Roster' && !!el.offsetParent;
    });
  });
}

test.describe('Roster Spec2 parity guardrails', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('cards view shows real IA eyebrow and hero tooltip uses current/max format', async ({ page }) => {
    await page.goto('/new/roster?view=cards');
    await page.waitForSelector('a[href^="/new/player/"]', { timeout: 45_000 });

    await expect.poll(() => hasVisibleEyebrow(page)).toBe(true);

    const heroIcon = page.locator(HERO_ALT_SELECTOR).first();
    await expect(heroIcon).toBeVisible();
    await heroIcon.hover();

    await expect(page.getByText(/\b\d+\/\d+\b/)).toBeVisible();
  });

  test('view switching preserves query state in URL', async ({ page }) => {
    await page.goto('/new/roster?view=cards&q=deter&status=current');
    await page.waitForSelector('a[href^="/new/player/"]', { timeout: 45_000 });

    await page.getByRole('button', { name: 'Table' }).click();

    await expect.poll(() => {
      const url = new URL(page.url());
      return `${url.searchParams.get('view')}|${url.searchParams.get('q')}|${url.searchParams.get('status')}`;
    }).toBe('table|deter|current');

    await page.getByRole('button', { name: 'Cards' }).click();

    await expect.poll(() => {
      const url = new URL(page.url());
      return `${url.searchParams.get('view')}|${url.searchParams.get('q')}|${url.searchParams.get('status')}`;
    }).toBe('cards|deter|current');
  });

  test('table row actions live in rightmost actions column', async ({ page }) => {
    await page.goto('/new/roster?view=table');
    await page.waitForSelector('table tbody tr', { timeout: 45_000 });

    await expect.poll(() => hasVisibleEyebrow(page)).toBe(true);

    const actionsInLastCell = await page.evaluate(() => {
      const row = document.querySelector('table tbody tr');
      if (!row) return false;
      return Boolean(row.querySelector('td:last-child button[aria-label="Row actions"]'));
    });

    const actionsInFirstCell = await page.evaluate(() => {
      const row = document.querySelector('table tbody tr');
      if (!row) return false;
      return Boolean(row.querySelector('td:first-child button[aria-label="Row actions"]'));
    });

    expect(actionsInLastCell).toBe(true);
    expect(actionsInFirstCell).toBe(false);
  });
});
