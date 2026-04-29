/**
 * ConsoleLayout.ts — Service Console / Workspace Tab Page Object
 *
 * Handles multi-tab workspace layouts used in Service Console,
 * Sales Console, and custom console apps.
 *
 * Selectors support both:
 * - Classic Console UI (Winter '25 and earlier)
 * - Redwood Console UI (Spring '26+ / Winter '26 updates)
 * - LWC-based workspace tabs (one-workspace-tab-item)
 */

import type { Page } from '@playwright/test';
import { waitForPageReady, waitForSalesforceNetwork, waitForSpinner, retryAction } from '../utils/sf-helpers';

export class ConsoleLayout {
  constructor(private page: Page) {}

  // ── Tab Management ────────────────────────────────────────

  async getOpenTabs(): Promise<string[]> {
    // Support both legacy tab selectors and new LWC workspace tab items
    const tabs = this.page.locator(
      'one-workspace-tab-item, ' +
      'li[role="presentation"] a[role="tab"], ' +
      'one-tab-item, ' +
      'lightning-tab-bar one-app-nav-bar-item-root',
    );
    const out: string[] = [];
    const n = await tabs.count();
    for (let i = 0; i < n; i++) {
      const t = await tabs.nth(i).getAttribute('title') || await tabs.nth(i).textContent();
      if (t?.trim()) out.push(t.trim());
    }
    return out;
  }

  async switchToTab(tabTitle: string): Promise<void> {
    await retryAction(async () => {
      const tab = this.page.locator(
        'one-workspace-tab-item, ' +
        'li[role="presentation"] a[role="tab"], ' +
        'one-tab-item',
      ).filter({ hasText: tabTitle }).first();
      await tab.click();
      await waitForPageReady(this.page);
    }, 2, 500);
  }

  async closeTab(tabTitle: string): Promise<void> {
    await retryAction(async () => {
      // Try LWC workspace tab first, then legacy
      const tabItem = this.page.locator(
        'one-workspace-tab-item, li[role="presentation"]',
      ).filter({ hasText: tabTitle }).first();
      const closeBtn = tabItem.locator(
        'button[title="Close"], button[aria-label*="Close"], lightning-button-icon[title*="Close"]',
      ).first();
      await closeBtn.click();
      await waitForPageReady(this.page);
    }, 2, 500);
  }

  async closeAllTabs(): Promise<void> {
    // Right-click on any tab to get the context menu
    const firstTab = this.page.locator(
      'one-workspace-tab-item, li[role="presentation"] a[role="tab"]',
    ).first();

    if (!(await firstTab.isVisible().catch(() => false))) return;

    await firstTab.click({ button: 'right' });
    const closeAll = this.page.getByRole('menuitem', { name: /close all/i });
    if (await closeAll.isVisible().catch(() => false)) {
      await closeAll.click();
      await waitForPageReady(this.page);
    } else {
      // Dismiss context menu if "Close All" not available
      await this.page.keyboard.press('Escape');
    }
  }

  async getActiveTabTitle(): Promise<string> {
    // Try multiple selector patterns for active tab detection
    const active = this.page.locator(
      'one-workspace-tab-item[aria-selected="true"], ' +
      'a[role="tab"][aria-selected="true"], ' +
      'one-tab-item[aria-selected="true"], ' +
      'li[role="presentation"][class*="active"] a[role="tab"]',
    ).first();
    return (await active.getAttribute('title') || await active.textContent())?.trim() || '';
  }

  // ── Utility Bar ───────────────────────────────────────────

  async isUtilityBarVisible(): Promise<boolean> {
    const bar = this.page.locator(
      'one-utility-bar, utilitybarhdr, [class*="utilityBarContainer"]',
    );
    return bar.isVisible().catch(() => false);
  }

  async openUtilityItem(utilityName: string): Promise<void> {
    await retryAction(async () => {
      const item = this.page.locator(
        'one-utility-bar-item, button[class*="utilitybar"], [class*="utilityBarItem"]',
      ).filter({ hasText: utilityName }).first();
      await item.click();
      await this.page.waitForTimeout(500);
    }, 2, 500);
  }

  async closeUtilityPanel(): Promise<void> {
    const minimize = this.page.locator(
      'button[title="Minimize window"], button[aria-label*="Minimize"], button[title="Minimize"]',
    ).first();
    if (await minimize.isVisible().catch(() => false)) {
      await minimize.click();
    }
  }

  async getUtilityBarItems(): Promise<string[]> {
    const items = this.page.locator(
      'one-utility-bar-item button, button[class*="utilitybar"], [class*="utilityBarItem"] button',
    );
    const out: string[] = [];
    const n = await items.count();
    for (let i = 0; i < n; i++) {
      const t = await items.nth(i).textContent();
      if (t?.trim()) out.push(t.trim());
    }
    return out;
  }

  // ── Split View ────────────────────────────────────────────

  async isSplitViewOpen(): Promise<boolean> {
    const splitView = this.page.locator(
      'split-view-list, [class*="splitView"], one-split-view',
    );
    return splitView.isVisible().catch(() => false);
  }

  async toggleSplitView(): Promise<void> {
    await retryAction(async () => {
      const toggle = this.page.locator(
        'button[title*="Split View"], button[aria-label*="Split View"], button[title*="split view"]',
      ).first();
      await toggle.click();
      await waitForPageReady(this.page);
    }, 2, 500);
  }
}
