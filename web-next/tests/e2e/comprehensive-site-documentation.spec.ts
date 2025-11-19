import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.setTimeout(900_000); // 15 minutes for comprehensive run (increased to handle all pages)

const CLAN_HOST = process.env.PLAYWRIGHT_CLAN_HOST || 'http://heckyeah.localhost:5050';
const TEST_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || 'do.ugfindlay@gmail.com';
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || 'testuser';

interface ScreenshotRecord {
  id: string;
  url: string;
  path: string[]; // Navigation path to get here
  timestamp: string;
  screenshotPath: string;
  elements: {
    type: 'input' | 'button' | 'select' | 'tab' | 'link' | 'checkbox' | 'radio';
    selector: string;
    label: string;
    value?: string;
    placeholder?: string;
    interacted: boolean;
    visible: boolean;
    enabled: boolean;
  }[];
  metadata: {
    title: string;
    viewport: { width: number; height: number };
    tabState?: string;
    formState?: Record<string, any>;
    pageType: string;
  };
}

const records: ScreenshotRecord[] = [];
const outputDir = path.join(process.cwd(), 'test_reports/site-documentation');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(path.join(outputDir, 'screenshots'))) {
  fs.mkdirSync(path.join(outputDir, 'screenshots'), { recursive: true });
}

async function signIn(page) {
  await page.goto(`${CLAN_HOST}/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.getByLabel('Email or Username').fill(TEST_EMAIL);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/app', { timeout: 10_000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded');
  try {
    await page.waitForSelector('h3:has-text("Quick Actions")', { 
      timeout: 10_000,
      state: 'visible'
    });
  } catch {
    await page.waitForTimeout(3000);
  }
}

async function captureState(
  page: any,
  pageConfig: any,
  navPath: string[],
  records: ScreenshotRecord[],
  outputDir: string,
  additionalContext: string = ''
): Promise<void> {
  const url = page.url();
  const timestamp = new Date().toISOString();
  const safePath = navPath.length > 0 ? navPath.join('-').replace(/[^a-zA-Z0-9-]/g, '-') : 'base';
  const recordId = `${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}-${safePath}-${Date.now()}`;
  const screenshotPath = path.join(outputDir, 'screenshots', `${recordId}.png`);
  
  // Wait for page to stabilize (with shorter timeout)
  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  
  // Capture full-page screenshot
  await page.screenshot({ 
    path: screenshotPath, 
    fullPage: true 
  });
  
  // Extract all interactive elements
  const elements = await extractElements(page);
  
  // Get page metadata
  const title = await page.title();
  const viewport = page.viewportSize();
  
  const record: ScreenshotRecord = {
    id: recordId,
    url,
    path: [pageConfig.name, ...navPath],
    timestamp,
    screenshotPath: `screenshots/${recordId}.png`,
    elements,
    metadata: {
      title,
      viewport: viewport || { width: 1920, height: 1080 },
      pageType: pageConfig.name,
      ...(additionalContext ? { context: additionalContext } : {}),
    },
  };
  
  records.push(record);
  console.log(`[Documentation] Captured: ${record.path.join(' > ')} (${elements.length} elements)`);
}

async function extractElements(page: any) {
  const elements = [];
  
  // Find all inputs (text, email, number, etc.)
  const inputs = await page.locator('input:not([type="hidden"]), textarea, select').all();
  for (const input of inputs) {
    try {
      const isVisible = await input.isVisible();
      if (!isVisible) continue;
      
      const tagName = await input.evaluate((el: any) => el.tagName.toLowerCase());
      const inputType = await input.getAttribute('type') || tagName;
      const label = await input.getAttribute('aria-label') || 
                   await input.getAttribute('placeholder') || 
                   await input.getAttribute('name') || 
                   await input.getAttribute('id') ||
                   'unnamed';
      const placeholder = await input.getAttribute('placeholder') || undefined;
      const value = await input.inputValue().catch(() => '');
      const isEnabled = await input.isEnabled();
      
      let selector = '';
      try {
        selector = await input.evaluate((el: any) => {
          if (el.id) return `#${el.id}`;
          if (el.name) return `[name="${el.name}"]`;
          if (el.className) return `.${el.className.split(' ')[0]}`;
          return el.tagName.toLowerCase();
        });
      } catch {
        selector = tagName;
      }
      
      elements.push({
        type: tagName === 'select' ? 'select' : 'input',
        selector,
        label: label.trim(),
        value: value || undefined,
        placeholder: placeholder,
        interacted: false,
        visible: isVisible,
        enabled: isEnabled,
      });
    } catch (e) {
      // Skip if element is detached
    }
  }
  
  // Find all buttons
  const buttons = await page.locator('button, [role="button"]').all();
  for (const button of buttons) {
    try {
      const isVisible = await button.isVisible();
      if (!isVisible) continue;
      
      const label = await button.textContent() || 
                   await button.getAttribute('aria-label') || 
                   await button.getAttribute('title') ||
                   'unnamed button';
      const isEnabled = await button.isEnabled();
      
      let selector = '';
      try {
        selector = await button.evaluate((el: any) => {
          if (el.id) return `#${el.id}`;
          if (el.className) return `.${el.className.split(' ')[0]}`;
          return el.tagName.toLowerCase();
        });
      } catch {
        selector = 'button';
      }
      
      // Skip navigation buttons to avoid infinite loops
      const buttonText = label.trim().toLowerCase();
      if (buttonText.includes('sign in') || buttonText.includes('sign out') || 
          buttonText.includes('navigation') || buttonText.includes('menu')) {
        continue;
      }
      
      elements.push({
        type: 'button',
        selector,
        label: label.trim(),
        interacted: false,
        visible: isVisible,
        enabled: isEnabled,
      });
    } catch (e) {
      // Skip if element is detached
    }
  }
  
  // Find all tabs
  const tabs = await page.locator('[role="tab"], button[aria-selected], [data-tab]').all();
  for (const tab of tabs) {
    try {
      const isVisible = await tab.isVisible();
      if (!isVisible) continue;
      
      const label = await tab.textContent() || 
                   await tab.getAttribute('aria-label') || 
                   await tab.getAttribute('data-tab') ||
                   'unnamed tab';
      const isActive = await tab.getAttribute('aria-selected') === 'true' ||
                      await tab.evaluate((el: any) => el.classList.contains('active')) ||
                      false;
      const isEnabled = await tab.isEnabled().catch(() => true);
      
      elements.push({
        type: 'tab',
        selector: await tab.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => 'tab'),
        label: label.trim(),
        value: isActive ? 'active' : 'inactive',
        interacted: false,
        visible: isVisible,
        enabled: isEnabled,
      });
    } catch (e) {
      // Skip if element is detached
    }
  }
  
  // Find all checkboxes and radio buttons
  const checkboxes = await page.locator('input[type="checkbox"], input[type="radio"]').all();
  for (const checkbox of checkboxes) {
    try {
      const isVisible = await checkbox.isVisible();
      if (!isVisible) continue;
      
      const inputType = await checkbox.getAttribute('type');
      const label = await checkbox.getAttribute('aria-label') || 
                   await checkbox.getAttribute('name') ||
                   await checkbox.getAttribute('id') ||
                   'unnamed';
      const isChecked = await checkbox.isChecked();
      const isEnabled = await checkbox.isEnabled();
      
      elements.push({
        type: inputType as 'checkbox' | 'radio',
        selector: await checkbox.evaluate((el: any) => {
          if (el.id) return `#${el.id}`;
          if (el.name) return `[name="${el.name}"]`;
          return 'input';
        }).catch(() => 'input'),
        label: label.trim(),
        value: isChecked ? 'checked' : 'unchecked',
        interacted: false,
        visible: isVisible,
        enabled: isEnabled,
      });
    } catch (e) {
      // Skip if element is detached
    }
  }
  
  // Find all links (excluding navigation)
  const links = await page.locator('a:not([href^="#"]):not([href=""])').all();
  for (const link of links.slice(0, 20)) { // Limit to first 20
    try {
      const isVisible = await link.isVisible();
      if (!isVisible) continue;
      
      const href = await link.getAttribute('href');
      const label = await link.textContent() || 
                   await link.getAttribute('aria-label') ||
                   href ||
                   'unnamed link';
      
      // Skip external links and navigation
      if (href && (href.startsWith('http') || href.startsWith('mailto:'))) {
        continue;
      }
      
      elements.push({
        type: 'link',
        selector: await link.evaluate((el: any) => {
          if (el.id) return `#${el.id}`;
          return 'a';
        }).catch(() => 'a'),
        label: label.trim(),
        value: href || undefined,
        interacted: false,
        visible: isVisible,
        enabled: true,
      });
    } catch (e) {
      // Skip if element is detached
    }
  }
  
  return elements;
}

async function clickTab(page: any, tabLabel: string): Promise<boolean> {
  try {
    // Try multiple selectors for tabs
    const tabSelectors = [
      `button:has-text("${tabLabel}")`,
      `[role="tab"]:has-text("${tabLabel}")`,
      `button[aria-label*="${tabLabel}"]`,
      `[data-tab="${tabLabel}"]`,
    ];
    
    for (const selector of tabSelectors) {
      const tab = page.locator(selector).first();
      if (await tab.isVisible({ timeout: 1000 })) {
        await tab.scrollIntoViewIfNeeded();
        await tab.click();
        await page.waitForTimeout(1000);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function documentPage(
  page: any,
  config: any,
  records: ScreenshotRecord[],
  outputDir: string
): Promise<void> {
  console.log(`[Documentation] Starting: ${config.name}`);
  
  // Navigate to page
  await page.goto(`${CLAN_HOST}${config.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  
  // Document base state
  await captureState(page, config, [], records, outputDir, 'initial-load');
  
  // Document all tabs if they exist
  if (config.tabs && config.tabs.length > 0) {
    for (const tab of config.tabs) {
      const clicked = await clickTab(page, tab);
      if (clicked) {
        await page.waitForTimeout(1500);
        await captureState(page, config, [`tab-${tab}`], records, outputDir, `tab-${tab}`);
      }
    }
  }
  
  // Try to find tabs dynamically (for pages with Tabs component)
  const tabButtons = await page.locator('[role="tab"], button[aria-selected]').all();
  if (tabButtons.length > 0) {
    const tabLabels: string[] = [];
    for (const tabBtn of tabButtons) {
      try {
        const label = await tabBtn.textContent();
        if (label && !tabLabels.includes(label.trim())) {
          tabLabels.push(label.trim());
        }
      } catch {}
    }
    
    for (const tabLabel of tabLabels.slice(0, 3)) { // Limit to 3 tabs to save time
      const clicked = await clickTab(page, tabLabel);
      if (clicked) {
        await page.waitForTimeout(1000);
        await captureState(page, config, [`tab-${tabLabel}`], records, outputDir, `tab-${tabLabel}`);
      }
    }
  }
  
  // Document Discord exhibit types (limit to 2 to save time)
  if (config.name === 'Discord Publisher') {
    const exhibitTypes = ['rushed', 'war-result']; // Just document 2 key exhibits
    for (const exhibit of exhibitTypes) {
      try {
        const exhibitButton = page.locator(`button:has-text("${exhibit}"), button[data-exhibit="${exhibit}"]`).first();
        if (await exhibitButton.isVisible({ timeout: 2000 })) {
          await exhibitButton.scrollIntoViewIfNeeded();
          await exhibitButton.click();
          await page.waitForTimeout(1500);
          await captureState(page, config, [`exhibit-${exhibit}`], records, outputDir, `exhibit-${exhibit}`);
        }
      } catch {}
    }
  }
  
  // Skip input/button interactions to avoid timeouts - focus on documenting states
  // All interactive elements are already captured in extractElements() for documentation
  
  console.log(`[Documentation] Completed: ${config.name}`);
}

function generateDocumentation(records: ScreenshotRecord[], outputDir: string): void {
  console.log(`[Documentation] Generating documentation for ${records.length} screenshots...`);
  
  // Generate JSON
  fs.writeFileSync(
    path.join(outputDir, 'site-documentation.json'),
    JSON.stringify(records, null, 2)
  );
  
  // Generate Markdown
  let markdown = '# Complete Site Documentation\n\n';
  markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
  markdown += `**Total Screenshots:** ${records.length}\n\n`;
  markdown += `**Total Interactive Elements:** ${records.reduce((sum, r) => sum + r.elements.length, 0)}\n\n`;
  markdown += `---\n\n`;
  
  // Group by page
  const pages = new Map<string, ScreenshotRecord[]>();
  for (const record of records) {
    const pageName = record.path[0] || 'Unknown';
    if (!pages.has(pageName)) {
      pages.set(pageName, []);
    }
    pages.get(pageName)!.push(record);
  }
  
  for (const [pageName, pageRecords] of pages.entries()) {
    markdown += `## ${pageName}\n\n`;
    markdown += `**Total States:** ${pageRecords.length}\n\n`;
    
    for (const record of pageRecords) {
      const pathLabel = record.path.slice(1).join(' > ') || 'Base State';
      markdown += `### ${pathLabel}\n\n`;
      markdown += `**URL:** \`${record.url}\`\n\n`;
      markdown += `**Timestamp:** ${record.timestamp}\n\n`;
      markdown += `**Viewport:** ${record.metadata.viewport.width}x${record.metadata.viewport.height}\n\n`;
      markdown += `![Screenshot](./${record.screenshotPath})\n\n`;
      
      if (record.elements.length > 0) {
        markdown += `#### Interactive Elements (${record.elements.length})\n\n`;
        
        // Group by type
        const byType = new Map<string, typeof record.elements>();
        for (const element of record.elements) {
          if (!byType.has(element.type)) {
            byType.set(element.type, []);
          }
          byType.get(element.type)!.push(element);
        }
        
        for (const [type, elements] of byType.entries()) {
          markdown += `**${type.toUpperCase()}** (${elements.length}):\n\n`;
          for (const element of elements) {
            markdown += `- \`${element.selector}\`: ${element.label}`;
            if (element.value) markdown += ` = \`${element.value}\``;
            if (element.placeholder) markdown += ` (placeholder: \`${element.placeholder}\`)`;
            markdown += ` ${element.enabled ? '✅' : '❌'} ${element.visible ? '👁️' : '🚫'}\n`;
          }
          markdown += `\n`;
        }
      }
      
      markdown += `---\n\n`;
    }
  }
  
  // Generate navigation flow diagram
  markdown += `## Navigation Flow\n\n`;
  markdown += `\`\`\`\n`;
  for (const record of records) {
    markdown += `${record.path.join(' → ')} → ${record.url}\n`;
  }
  markdown += `\`\`\`\n\n`;
  
  // Generate element inventory
  markdown += `## Complete Element Inventory\n\n`;
  const allElements = new Map<string, number>();
  for (const record of records) {
    for (const element of record.elements) {
      const key = `${element.type}:${element.label}`;
      allElements.set(key, (allElements.get(key) || 0) + 1);
    }
  }
  
  markdown += `**Total Unique Elements:** ${allElements.size}\n\n`;
  for (const [key, count] of Array.from(allElements.entries()).sort()) {
    markdown += `- ${key} (appears ${count} time${count > 1 ? 's' : ''})\n`;
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'site-documentation.md'),
    markdown
  );
  
  console.log(`[Documentation] Generated: ${path.join(outputDir, 'site-documentation.md')}`);
  console.log(`[Documentation] Generated: ${path.join(outputDir, 'site-documentation.json')}`);
}

test.describe('Comprehensive Site Documentation', () => {
  test('document entire site flow', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Sign in first
    await signIn(page);
    
    // Define all pages to document
    const pages = [
      { 
        path: '/app', 
        name: 'Dashboard', 
        tabs: [] // Will discover tabs dynamically
      },
      { 
        path: '/war', 
        name: 'War Planning', 
        tabs: [] 
      },
      { 
        path: '/war-analytics', 
        name: 'War Analytics', 
        tabs: [] 
      },
      { 
        path: '/capital-analytics', 
        name: 'Capital Analytics', 
        tabs: [] 
      },
      {
        path: '/player-database', 
        name: 'Player Database', 
        tabs: [] 
      },
      { 
        path: '/discord', 
        name: 'Discord Publisher', 
        tabs: [] 
      },
      { 
        path: '/leadership', 
        name: 'Leadership', 
        tabs: ['Overview', 'Analytics', 'Management'] 
      },
      { 
        path: '/settings', 
        name: 'Settings', 
        tabs: [] 
      },
    ];
    
    for (const pageConfig of pages) {
      await documentPage(page, pageConfig, records, outputDir);
    }
    
    // Generate documentation
    generateDocumentation(records, outputDir);
    
    console.log(`\n[Documentation] Complete! Generated ${records.length} screenshots.`);
    console.log(`[Documentation] Output: ${outputDir}`);
  });
});

