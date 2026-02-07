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

  test('light theme applies to shell chrome (sidebar, header, main) on /new routes', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('clash-intelligence-theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    });

    await page.goto('/new/roster?view=cards');
    await page.waitForFunction(() => {
      const sidebar = document.querySelector('[data-testid="app-shell-sidebar"], aside');
      const header = document.querySelector('[data-testid="app-shell-header"], header');
      const main = document.querySelector('[data-testid="app-shell-main"], main');
      return Boolean(sidebar && header && main);
    }, { timeout: 45_000 });

    const shellStyles = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="app-shell-sidebar"], aside') as HTMLElement | null;
      const header = document.querySelector('[data-testid="app-shell-header"], header') as HTMLElement | null;
      const main = document.querySelector('[data-testid="app-shell-main"], main') as HTMLElement | null;

      if (!sidebar || !header || !main) {
        return null;
      }

      const probe = document.createElement('div');
      probe.style.position = 'fixed';
      probe.style.opacity = '0';
      probe.style.pointerEvents = 'none';
      document.body.appendChild(probe);

      const serializeBackground = (el: HTMLElement) => {
        const css = window.getComputedStyle(el);
        return `${css.backgroundColor}|${css.backgroundImage}`;
      };

      const expectedBackground = (token: string) => {
        probe.style.background = token;
        return serializeBackground(probe);
      };

      probe.style.color = 'var(--shell-text)';
      const expectedShellText = window.getComputedStyle(probe).color;

      const result = {
        theme: document.documentElement.getAttribute('data-theme'),
        shellTextColor: window.getComputedStyle(main).color,
        expectedShellText,
        sidebarBackground: serializeBackground(sidebar),
        headerBackground: serializeBackground(header),
        mainBackground: serializeBackground(main),
        expectedSidebarBackground: expectedBackground('var(--shell-sidebar-bg)'),
        expectedHeaderBackground: expectedBackground('var(--shell-header-bg)'),
        expectedMainBackground: expectedBackground('var(--shell-main-bg)'),
      };

      probe.remove();
      return result;
    });

    expect(shellStyles).not.toBeNull();
    expect(shellStyles?.theme).toBe('light');
    expect(shellStyles?.shellTextColor).toBe(shellStyles?.expectedShellText);
    expect(shellStyles?.sidebarBackground).toBe(shellStyles?.expectedSidebarBackground);
    expect(shellStyles?.headerBackground).toBe(shellStyles?.expectedHeaderBackground);
    expect(shellStyles?.mainBackground).toBe(shellStyles?.expectedMainBackground);
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

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.hover();
    const rowActionsButton = firstRow.locator('td:last-child button[aria-label="Row actions"]');
    await expect(rowActionsButton).toBeVisible();
    await rowActionsButton.click();

    await expect(page.getByRole('menuitem', { name: 'Open profile' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Copy player tag' })).toBeVisible();
  });

  test('table player link opens new player profile route without chunk load failure', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/new/roster?view=table');
    await page.waitForSelector('table tbody tr', { timeout: 45_000 });

    const firstPlayerLink = page.locator('table tbody tr td:first-child a[href^="/new/player/"]:visible').first();
    await expect(firstPlayerLink).toBeVisible();
    await firstPlayerLink.click();

    await expect.poll(() => page.url()).toContain('/new/player/');
    await expect(page.getByRole('link', { name: '← Back to roster' })).toBeVisible();

    const chunkFailure = pageErrors.find((message) =>
      /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(message),
    );

    expect(chunkFailure).toBeUndefined();
  });
});
