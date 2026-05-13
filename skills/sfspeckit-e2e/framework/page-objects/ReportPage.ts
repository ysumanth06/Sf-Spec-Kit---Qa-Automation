/**
 * ReportPage.ts — Report & Dashboard Page Object
 *
 * Handles Salesforce Report and Dashboard interactions
 * including running reports, verifying results, and dashboard components.
 *
 * Selectors support both:
 * - Classic Report UI (table[class*="report"])
 * - Redwood Report UI (Spring '26+ with analytics components)
 * - Lightning Report Builder (analytics-reporting-*)
 */

import type { Page } from '@playwright/test';
import { waitForPageReady, waitForSalesforceNetwork, waitForSpinner, retryAction } from '../utils/sf-helpers';

export class ReportPage {
  constructor(private page: Page) {}

  // ── Report Navigation ─────────────────────────────────────

  async openReport(reportId: string): Promise<void> {
    await this.page.goto(`/lightning/r/Report/${reportId}/view`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForPageReady(this.page);
    await waitForSalesforceNetwork(this.page);
  }

  async runReport(): Promise<void> {
    await retryAction(async () => {
      await this.page.getByRole('button', { name: /run/i }).click();
      await waitForSpinner(this.page, 60_000);
      await waitForSalesforceNetwork(this.page);
    }, 2, 1_000);
  }

  // ── Report Results ────────────────────────────────────────

  async getReportTitle(): Promise<string> {
    const title = this.page.locator(
      'h1, [class*="report-header"] span, ' +
      'analytics-reporting-report-header h1, ' +
      'lightning-formatted-text[class*="title"]',
    ).first();
    return (await title.textContent().catch(() => ''))?.trim() || '';
  }

  async getRowCount(): Promise<number> {
    const countEl = this.page.locator(
      'span[class*="rowCount"], span:has-text("rows"), ' +
      '[class*="grand-total"], [class*="recordCount"], ' +
      'analytics-reporting-status span',
    ).first();
    const text = (await countEl.textContent().catch(() => ''))?.trim() || '';
    const match = text.match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
  }

  async getColumnHeaders(): Promise<string[]> {
    // Support both classic table and Redwood analytics table
    const headers = this.page.locator(
      'table[class*="report"] th, ' +
      '[class*="report-cell"] [class*="header"], ' +
      'analytics-reporting-data-table th, ' +
      'table[role="grid"] th, ' +
      '[data-component-id*="report"] th',
    );
    const out: string[] = [];
    const n = await headers.count();
    for (let i = 0; i < n; i++) {
      const t = await headers.nth(i).textContent();
      if (t?.trim()) out.push(t.trim());
    }
    return out;
  }

  async getCellValue(rowIndex: number, columnName: string): Promise<string> {
    // Find column index by scanning headers
    const headerSelector =
      'table[class*="report"] th, analytics-reporting-data-table th, table[role="grid"] th';
    const headers = this.page.locator(headerSelector);
    const headerCount = await headers.count();
    let colIndex = -1;

    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text?.trim().includes(columnName)) {
        colIndex = i;
        break;
      }
    }

    if (colIndex === -1) return '';

    const rowSelector =
      'table[class*="report"] tbody tr, analytics-reporting-data-table tbody tr, table[role="grid"] tbody tr';
    const row = this.page.locator(rowSelector).nth(rowIndex);
    const cell = row.locator('td').nth(colIndex);
    return (await cell.textContent().catch(() => ''))?.trim() || '';
  }

  async getGrandTotal(columnName: string): Promise<string> {
    const totalRow = this.page.locator(
      'tr[class*="grand-total"], tr:has-text("Grand Totals"), ' +
      '[class*="grandTotal"], analytics-reporting-grand-total',
    ).first();
    // Find which column has this name and get the corresponding total cell
    return (await totalRow.textContent().catch(() => ''))?.trim() || '';
  }

  // ── Filters ───────────────────────────────────────────────

  async addFilter(fieldName: string, operator: string, value: string): Promise<void> {
    await retryAction(async () => {
      // Click Add Filter
      const addFilter = this.page.getByRole('button', { name: /add filter|filter/i }).first();
      await addFilter.click();
      await this.page.waitForTimeout(500);

      // Select field — support both classic and Redwood filter UI
      const fieldInput = this.page.locator(
        'input[placeholder*="field"], input[aria-label*="Field"], ' +
        'input[placeholder*="Search"], analytics-reporting-filter-input input',
      ).first();
      await fieldInput.fill(fieldName);
      await this.page.waitForTimeout(500);
      await this.page.getByRole('option', { name: fieldName, exact: false }).first().click();

      // Select operator
      const opSelector = this.page.locator(
        'select, lightning-combobox, analytics-reporting-filter-operator',
      ).filter({
        has: this.page.getByText(/operator|equals/i),
      }).first();
      if (await opSelector.isVisible().catch(() => false)) {
        await opSelector.selectOption({ label: operator });
      }

      // Enter value
      const valueInput = this.page.locator(
        'input[placeholder*="value"], input[aria-label*="Value"], ' +
        'analytics-reporting-filter-value input',
      ).first();
      await valueInput.fill(value);

      // Apply
      await this.page.getByRole('button', { name: /apply|done/i }).first().click();
      await waitForSalesforceNetwork(this.page);
    }, 2, 1_000);
  }

  // ── Dashboard ─────────────────────────────────────────────

  async openDashboard(dashboardId: string): Promise<void> {
    await this.page.goto(`/lightning/r/Dashboard/${dashboardId}/view`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForPageReady(this.page);
    await waitForSalesforceNetwork(this.page);
  }

  async refreshDashboard(): Promise<void> {
    await retryAction(async () => {
      await this.page.getByRole('button', { name: /refresh/i }).click();
      await waitForSpinner(this.page, 60_000);
      await waitForSalesforceNetwork(this.page);
    }, 2, 1_000);
  }

  async getDashboardComponentTitles(): Promise<string[]> {
    const components = this.page.locator(
      'article[class*="dashboard"], [class*="dashboardComponent"], ' +
      'analytics-dashboard-widget, [class*="widgetContainer"]',
    );
    const out: string[] = [];
    const n = await components.count();
    for (let i = 0; i < n; i++) {
      const title = components.nth(i).locator('h2, header, span[class*="title"]').first();
      const t = await title.textContent().catch(() => '');
      if (t?.trim()) out.push(t.trim());
    }
    return out;
  }

  async getDashboardComponentValue(componentTitle: string): Promise<string> {
    const component = this.page.locator(
      'article[class*="dashboard"], [class*="dashboardComponent"], ' +
      'analytics-dashboard-widget, [class*="widgetContainer"]',
    ).filter({ hasText: componentTitle }).first();
    const value = component.locator(
      '[class*="metric"], [class*="value"], span[class*="number"], ' +
      'analytics-dashboard-metric-value',
    ).first();
    return (await value.textContent().catch(() => ''))?.trim() || '';
  }
}
