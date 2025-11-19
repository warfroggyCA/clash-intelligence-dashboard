import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const CLAN_HOST = process.env.PLAYWRIGHT_CLAN_HOST || 'http://heckyeah.localhost:5050';
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || 'do.ugfindlay@gmail.com';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || 'testuser';

// Ensure audit directories exist
const auditDir = path.join(process.cwd(), 'test_reports', 'ui-ux-audit');
const screenshotsDir = path.join(auditDir, 'screenshots');
const findingsDir = path.join(auditDir, 'findings');

[auditDir, screenshotsDir, findingsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

interface PageAudit {
  url: string;
  title: string;
  hasHeaderTabs: boolean;
  headerTabCount: number;
  headerTabLabels: string[];
  hasBreadcrumbs: boolean;
  hasTooltips: boolean;
  tooltipCount: number;
  mainContentSections: number;
  scrollHeight: number;
  viewportHeight: number;
  requiresScroll: boolean;
  hasConsistentNavigation: boolean;
  issues: string[];
  recommendations: string[];
  screenshotPath: string;
}

async function signIn(page: any) {
  await page.goto(`${CLAN_HOST}/login`);
  await page.getByLabel('Email or Username').fill(TEST_EMAIL);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/app', { timeout: 10_000 }).catch(() => {});
  try {
    await page.waitForSelector('h1, h2, h3', { timeout: 10_000 });
  } catch {
    await page.waitForTimeout(3000);
  }
}

async function auditPage(
  page: any,
  url: string,
  title: string,
  options: { waitForSelector?: string; waitTime?: number } = {}
): Promise<PageAudit> {
  await page.goto(url);
  await page.waitForTimeout(options.waitTime || 3000);
  
  if (options.waitForSelector) {
    try {
      await page.waitForSelector(options.waitForSelector, { timeout: 5000 });
    } catch {
      // Continue if selector not found
    }
  }

  // Wait for any loading states
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const audit: PageAudit = {
    url,
    title,
    hasHeaderTabs: false,
    headerTabCount: 0,
    headerTabLabels: [],
    hasBreadcrumbs: false,
    hasTooltips: false,
    tooltipCount: 0,
    mainContentSections: 0,
    scrollHeight: 0,
    viewportHeight: 0,
    requiresScroll: false,
    hasConsistentNavigation: false,
    issues: [],
    recommendations: [],
    screenshotPath: '',
  };

  // Check for header tabs
  const headerTabs = await page.locator('[role="tab"], button[class*="tab"], nav a').all();
  const tabNavigation = await page.locator('[class*="TabNavigation"], nav[class*="tab"]').first();
  if (tabNavigation.isVisible().catch(() => false)) {
    audit.hasHeaderTabs = true;
    const tabs = await page.locator('[role="tab"], button[class*="tab"]').all();
    audit.headerTabCount = tabs.length;
    for (const tab of tabs) {
      const text = await tab.textContent().catch(() => '');
      if (text) audit.headerTabLabels.push(text.trim());
    }
  }

  // Check for breadcrumbs
  const breadcrumbs = await page.locator('[class*="breadcrumb"], nav[aria-label*="breadcrumb"]').first();
  audit.hasBreadcrumbs = await breadcrumbs.isVisible().catch(() => false);

  // Check for tooltips (elements with title attribute or data-tooltip)
  const tooltipElements = await page.locator('[title], [data-tooltip], [aria-label]').all();
  audit.tooltipCount = tooltipElements.length;
  audit.hasTooltips = audit.tooltipCount > 0;

  // Check main content sections
  const sections = await page.locator('section, [class*="section"], [class*="card"], [class*="Card"]').all();
  audit.mainContentSections = sections.length;

  // Check scroll requirements
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  audit.scrollHeight = scrollHeight;
  audit.viewportHeight = viewportHeight;
  audit.requiresScroll = scrollHeight > viewportHeight * 1.2; // More than 20% overflow

  // Check for consistent navigation (TabNavigation component)
  const hasTabNav = await page.locator('[class*="TabNavigation"]').isVisible().catch(() => false);
  audit.hasConsistentNavigation = hasTabNav;

  // Generate screenshot
  const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  audit.screenshotPath = path.join(screenshotsDir, `${safeTitle}.png`);
  await page.screenshot({ 
    path: audit.screenshotPath,
    fullPage: true 
  });

  // Analyze issues
  if (!audit.hasConsistentNavigation && !url.includes('/app')) {
    audit.issues.push('Missing consistent header navigation tabs');
  }

  if (audit.requiresScroll && scrollHeight > viewportHeight * 2) {
    audit.issues.push('Page is very long - consider breaking into tabs or sections');
  }

  if (audit.mainContentSections === 0) {
    audit.issues.push('No clear content sections detected - may lack visual hierarchy');
  }

  if (audit.tooltipCount === 0 && audit.mainContentSections > 5) {
    audit.recommendations.push('Consider adding tooltips to help users understand complex metrics');
  }

  if (audit.headerTabCount > 0 && audit.headerTabCount < 3) {
    audit.recommendations.push('Consider consolidating or expanding tab structure for better organization');
  }

  return audit;
}

test.describe('UI/UX Comprehensive Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('audit all target pages', async ({ page }) => {
    test.slow();
    // Sign in first
    await signIn(page);

    const audits: PageAudit[] = [];

    // 1. War Planning
    const warPlanningAudit = await auditPage(
      page,
      `${CLAN_HOST}/war`,
      'War Planning',
      { waitTime: 5000 }
    );
    audits.push(warPlanningAudit);

    // Check for sub-pages in War Planning
    const warPrepLink = page.locator('a[href*="/war/prep"], a[href*="/war/planning"]').first();
    if (await warPrepLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      const warPrepUrl = await warPrepLink.getAttribute('href').catch(() => null);
      if (warPrepUrl) {
        const fullUrl = warPrepUrl.startsWith('http') ? warPrepUrl : `${CLAN_HOST}${warPrepUrl}`;
        const warPrepAudit = await auditPage(page, fullUrl, 'War Planning - Prep', { waitTime: 3000 });
        audits.push(warPrepAudit);
      }
    }

    // 2. War Analytics
    const warAnalyticsAudit = await auditPage(
      page,
      `${CLAN_HOST}/war-analytics`,
      'War Analytics',
      { waitTime: 5000 }
    );
    audits.push(warAnalyticsAudit);

    // 3. Capital Analytics
    const capitalAnalyticsAudit = await auditPage(
      page,
      `${CLAN_HOST}/capital-analytics`,
      'Capital Analytics',
      { waitTime: 5000 }
    );
    audits.push(capitalAnalyticsAudit);

    // 4. Player Database
    const playerDatabaseAudit = await auditPage(
      page,
      `${CLAN_HOST}/player-database`,
      'Player Database',
      { waitTime: 3000 }
    );
    audits.push(playerDatabaseAudit);

    // 5. Leadership
    const leadershipAudit = await auditPage(
      page,
      `${CLAN_HOST}/leadership`,
      'Leadership',
      { waitTime: 5000 }
    );
    audits.push(leadershipAudit);

    // Generate comprehensive report
    const report = {
      generatedAt: new Date().toISOString(),
      totalPagesAudited: audits.length,
      summary: {
        pagesWithTabs: audits.filter(a => a.hasHeaderTabs).length,
        pagesWithBreadcrumbs: audits.filter(a => a.hasBreadcrumbs).length,
        pagesWithTooltips: audits.filter(a => a.hasTooltips).length,
        pagesRequiringScroll: audits.filter(a => a.requiresScroll).length,
        pagesWithConsistentNav: audits.filter(a => a.hasConsistentNavigation).length,
      },
      pages: audits,
      crossPageIssues: [] as string[],
      recommendations: [] as string[],
    };

    // Cross-page analysis
    const tabCounts = audits.map(a => a.headerTabCount).filter(c => c > 0);
    if (tabCounts.length > 0) {
      const avgTabs = tabCounts.reduce((a, b) => a + b, 0) / tabCounts.length;
      const inconsistentTabs = audits.filter(a => 
        a.hasHeaderTabs && Math.abs(a.headerTabCount - avgTabs) > 2
      );
      if (inconsistentTabs.length > 0) {
        report.crossPageIssues.push(
          `Inconsistent tab counts across pages. Some pages have ${Math.min(...tabCounts)} tabs, others have ${Math.max(...tabCounts)} tabs.`
        );
      }
    }

    const navInconsistent = audits.filter(a => !a.hasConsistentNavigation && !a.url.includes('/app'));
    if (navInconsistent.length > 0) {
      report.crossPageIssues.push(
        `${navInconsistent.length} page(s) missing consistent header navigation: ${navInconsistent.map(a => a.title).join(', ')}`
      );
    }

    const longPages = audits.filter(a => a.requiresScroll && a.scrollHeight > a.viewportHeight * 2);
    if (longPages.length > 0) {
      report.recommendations.push(
        `Consider breaking these long pages into tabs or collapsible sections: ${longPages.map(a => a.title).join(', ')}`
      );
    }

    const pagesWithoutTooltips = audits.filter(a => !a.hasTooltips && a.mainContentSections > 3);
    if (pagesWithoutTooltips.length > 0) {
      report.recommendations.push(
        `Consider adding tooltips to help users understand metrics on: ${pagesWithoutTooltips.map(a => a.title).join(', ')}`
      );
    }

    // Save report
    const reportPath = path.join(findingsDir, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown summary
    const markdownReport = generateMarkdownReport(report);
    const markdownPath = path.join(findingsDir, 'audit-report.md');
    fs.writeFileSync(markdownPath, markdownReport);

    console.log(`\n✅ Audit complete! Report saved to: ${reportPath}`);
    console.log(`📄 Markdown report: ${markdownPath}`);
    console.log(`📸 Screenshots: ${screenshotsDir}`);
  });
});

function generateMarkdownReport(report: any): string {
  const lines: string[] = [];
  
  lines.push('# UI/UX Audit Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push(`**Total Pages Audited:** ${report.totalPagesAudited}`);
  lines.push('');

  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`- Pages with header tabs: ${report.summary.pagesWithTabs}/${report.totalPagesAudited}`);
  lines.push(`- Pages with breadcrumbs: ${report.summary.pagesWithBreadcrumbs}/${report.totalPagesAudited}`);
  lines.push(`- Pages with tooltips: ${report.summary.pagesWithTooltips}/${report.totalPagesAudited}`);
  lines.push(`- Pages requiring scroll: ${report.summary.pagesRequiringScroll}/${report.totalPagesAudited}`);
  lines.push(`- Pages with consistent navigation: ${report.summary.pagesWithConsistentNav}/${report.totalPagesAudited}`);
  lines.push('');

  if (report.crossPageIssues.length > 0) {
    lines.push('## Cross-Page Issues');
    lines.push('');
    report.crossPageIssues.forEach((issue: string) => {
      lines.push(`- ⚠️ ${issue}`);
    });
    lines.push('');
  }

  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    report.recommendations.forEach((rec: string) => {
      lines.push(`- 💡 ${rec}`);
    });
    lines.push('');
  }

  lines.push('## Page-by-Page Analysis');
  lines.push('');
  
  report.pages.forEach((page: PageAudit) => {
    lines.push(`### ${page.title}`);
    lines.push('');
    lines.push(`**URL:** ${page.url}`);
    lines.push(`**Screenshot:** \`${path.relative(process.cwd(), page.screenshotPath)}\``);
    lines.push('');
    lines.push('**Structure:**');
    lines.push(`- Header tabs: ${page.hasHeaderTabs ? `Yes (${page.headerTabCount} tabs: ${page.headerTabLabels.join(', ')})` : 'No'}`);
    lines.push(`- Breadcrumbs: ${page.hasBreadcrumbs ? 'Yes' : 'No'}`);
    lines.push(`- Tooltips: ${page.hasTooltips ? `Yes (${page.tooltipCount} elements)` : 'No'}`);
    lines.push(`- Content sections: ${page.mainContentSections}`);
    lines.push(`- Scroll required: ${page.requiresScroll ? `Yes (${Math.round(page.scrollHeight / page.viewportHeight)}x viewport)` : 'No'}`);
    lines.push(`- Consistent navigation: ${page.hasConsistentNavigation ? 'Yes' : 'No'}`);
    lines.push('');

    if (page.issues.length > 0) {
      lines.push('**Issues:**');
      page.issues.forEach((issue: string) => {
        lines.push(`- ⚠️ ${issue}`);
      });
      lines.push('');
    }

    if (page.recommendations.length > 0) {
      lines.push('**Recommendations:**');
      page.recommendations.forEach((rec: string) => {
        lines.push(`- 💡 ${rec}`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}
