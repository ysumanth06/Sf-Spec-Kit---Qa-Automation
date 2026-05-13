/**
 * CommunityPage.ts — Experience Cloud / Communities Page Object
 *
 * Handles Experience Cloud (formerly Communities) page interactions
 * including login, navigation, record access, and guest user verification.
 *
 * Selectors support both:
 * - Aura-based templates (community_navigation-navigation-list)
 * - LWR-based templates (c-navigation, [data-region-name], nav[aria-label])
 * - Build Your Own (BYO) templates with custom navigation
 */

import type { Page } from '@playwright/test';
import { waitForPageReady, waitForSalesforceNetwork, retryAction } from '../utils/sf-helpers';

export class CommunityPage {
  constructor(private page: Page) {}

  // ── Authentication ────────────────────────────────────────

  async login(communityUrl: string, username: string, password: string): Promise<void> {
    const loginUrl = communityUrl.replace(/\/$/, '') +
      (communityUrl.includes('/s/') ? '' : '/s/login');
    await this.page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

    await retryAction(async () => {
      await this.page.locator('input#username, input[name="username"]').first().fill(username);
      await this.page.locator('input#password, input[name="pw"]').first().fill(password);
      await this.page.locator('input[type="submit"], button[type="submit"]').first().click();
      await waitForPageReady(this.page);
    }, 2, 1_000);
  }

  async isLoggedIn(): Promise<boolean> {
    const userMenu = this.page.locator(
      'button[class*="profileTrigger"], a[class*="userProfileLink"], ' +
      'div[class*="user-menu"], [data-id="profileTrigger"], ' +
      'c-user-profile-menu, lightning-menu-trigger',
    );
    return userMenu.first().isVisible().catch(() => false);
  }

  async logout(): Promise<void> {
    const userMenu = this.page.locator(
      'button[class*="profileTrigger"], a[class*="userProfileLink"], ' +
      '[data-id="profileTrigger"], c-user-profile-menu',
    ).first();
    await userMenu.click();
    await this.page.getByRole('link', { name: /log out|sign out/i }).click();
    await waitForPageReady(this.page);
  }

  // ── Navigation ────────────────────────────────────────────

  async navigateTo(pagePath: string): Promise<void> {
    const currentUrl = this.page.url();
    const baseUrl = currentUrl.replace(/\/s\/.*/, '');
    const target = `${baseUrl}/s/${pagePath.replace(/^\/s\//, '')}`;
    await this.page.goto(target, { waitUntil: 'domcontentloaded' });
    await waitForPageReady(this.page);
  }

  async getNavigationItems(): Promise<string[]> {
    // Support Aura templates, LWR templates, and standard nav
    const navItems = this.page.locator(
      'community_navigation-navigation-list a, ' +         // Aura template
      'c-navigation a, ' +                                  // LWR custom component
      'nav[aria-label] a, ' +                               // LWR standard nav
      '[data-region-name="navigation"] a, ' +               // LWR region-based
      'community_navigation-global-navigation-list a, ' +   // Global nav
      'nav a',                                               // Fallback
    );
    const out: string[] = [];
    const seen = new Set<string>();
    const n = await navItems.count();
    for (let i = 0; i < n; i++) {
      const t = await navItems.nth(i).textContent();
      if (t?.trim() && !seen.has(t.trim())) {
        seen.add(t.trim());
        out.push(t.trim());
      }
    }
    return out;
  }

  async clickNavigationItem(itemName: string): Promise<void> {
    await retryAction(async () => {
      // Try Aura nav first, then LWR, then generic
      const item = this.page.locator(
        'community_navigation-navigation-list a, ' +
        'c-navigation a, ' +
        'nav[aria-label] a, ' +
        '[data-region-name="navigation"] a, ' +
        'nav a',
      ).filter({ hasText: itemName }).first();
      await item.click();
      await waitForPageReady(this.page);
    }, 2, 500);
  }

  // ── Content ───────────────────────────────────────────────

  async getPageTitle(): Promise<string> {
    const title = this.page.locator(
      'h1, [class*="page-title"], [data-region-name="content"] h1, c-page-header h1',
    ).first();
    return (await title.textContent().catch(() => ''))?.trim() || '';
  }

  async getRecordDetailValue(fieldLabel: string): Promise<string> {
    // Support both standard Lightning record detail and community-specific layouts
    const field = this.page.locator(
      '[class*="detail-row"], [class*="record-field"], ' +
      'records-record-layout-item, lightning-output-field, ' +
      'c-record-detail-field',
    ).filter({ hasText: fieldLabel }).first();
    const value = field.locator('span, dd, [class*="value"], lightning-formatted-text').last();
    return (await value.textContent().catch(() => ''))?.trim() || '';
  }

  // ── Case / Form Submission ────────────────────────────────

  async fillFormField(label: string, value: string): Promise<void> {
    await retryAction(async () => {
      const input = this.page.getByLabel(label, { exact: false });
      await input.click();
      await input.fill(value);
    }, 2, 500);
  }

  async submitForm(): Promise<void> {
    await retryAction(async () => {
      await this.page.getByRole('button', { name: /submit|save|send/i }).first().click();
      await waitForSalesforceNetwork(this.page);
      await waitForPageReady(this.page);
    }, 2, 1_000);
  }

  // ── Guest User Verification ───────────────────────────────

  async isGuestUser(): Promise<boolean> {
    const loginBtn = this.page.locator(
      'a[href*="login"], a[class*="login"], button:has-text("Log In"), ' +
      '[data-id="loginButton"], c-login-form',
    );
    return loginBtn.first().isVisible().catch(() => false);
  }

  async assertGuestCannotAccess(pagePath: string): Promise<boolean> {
    await this.navigateTo(pagePath);
    // Guest should be redirected to login or see an error
    const url = this.page.url();
    return url.includes('login') || url.includes('error') || url.includes('unauthorized');
  }
}
