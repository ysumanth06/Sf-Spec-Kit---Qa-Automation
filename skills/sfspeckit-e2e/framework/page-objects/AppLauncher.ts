/**
 * AppLauncher.ts — App Launcher & Navigation Page Object
 *
 * Handles Salesforce App Launcher, navigation between apps,
 * and global search interactions.
 */

import type { Page } from '@playwright/test';
import { waitForPageReady, waitForSalesforceNetwork, waitForSpinner } from '../utils/sf-helpers';

export class AppLauncher {
  constructor(private page: Page) {}

  async openAppLauncher(): Promise<void> {
    const waffle = this.page.locator(
      'button[class*="appLauncher"], div.slds-icon-waffle, button[title="App Launcher"]',
    ).first();
    await waffle.click();
    await this.page.waitForSelector(
      'one-app-launcher-modal, div[class*="appLauncher"]',
      { state: 'visible', timeout: 10_000 },
    );
  }

  async searchApp(appName: string): Promise<void> {
    const searchInput = this.page.locator(
      'input[placeholder*="Search apps"], input[type="search"]',
    ).first();
    await searchInput.fill(appName);
    await this.page.waitForTimeout(1_000);
  }

  async selectApp(appName: string): Promise<void> {
    await this.openAppLauncher();
    await this.searchApp(appName);
    await this.page.getByRole('option', { name: appName, exact: false }).first().click();
    await waitForPageReady(this.page);
    await waitForSalesforceNetwork(this.page);
  }

  async getCurrentAppName(): Promise<string> {
    const appName = this.page.locator('span.appName, one-app-launcher-header span').first();
    return (await appName.textContent().catch(() => ''))?.trim() || '';
  }

  async getVisibleNavItems(): Promise<string[]> {
    const items = this.page.locator('one-app-nav-bar-item-root a span');
    const out: string[] = [];
    const n = await items.count();
    for (let i = 0; i < n; i++) {
      const t = await items.nth(i).textContent();
      if (t?.trim()) out.push(t.trim());
    }
    return out;
  }

  async clickNavItem(itemName: string): Promise<void> {
    const navItem = this.page.locator('one-app-nav-bar-item-root', {
      has: this.page.getByText(itemName, { exact: true }),
    });
    await navItem.click();
    await waitForPageReady(this.page);
    await waitForSalesforceNetwork(this.page);
  }

  // ── Global Search ───────────────────────────────────────

  async globalSearch(searchTerm: string): Promise<void> {
    const searchBtn = this.page.locator(
      'button[class*="search-button"], button[aria-label="Search"]',
    ).first();
    await searchBtn.click();

    const input = this.page.locator(
      'input[placeholder*="Search"], input[class*="search-input"]',
    ).first();
    await input.fill(searchTerm);
    await this.page.keyboard.press('Enter');
    await waitForSalesforceNetwork(this.page);
    await waitForPageReady(this.page);
  }

  async getSearchResults(): Promise<string[]> {
    const results = this.page.locator(
      'search_dialog-instant-result-item, li[class*="searchResult"]',
    );
    const out: string[] = [];
    const n = await results.count();
    for (let i = 0; i < n; i++) {
      const t = await results.nth(i).textContent();
      if (t?.trim()) out.push(t.trim());
    }
    return out;
  }
}
