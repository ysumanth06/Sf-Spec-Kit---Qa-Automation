/**
 * ListView.ts — List View Page Object
 *
 * Handles Salesforce list view interactions including search, filters,
 * column navigation, row selection, and mass actions.
 */

import type { Page, Locator } from '@playwright/test';
import { waitForPageReady, waitForSpinner, waitForSalesforceNetwork, retryAction } from '../utils/sf-helpers';
import { LIST_VIEW, SLDS, getButtonByName } from '../utils/selectors';

export class ListView {
  constructor(private page: Page) {}

  // ── Navigation ────────────────────────────────────────────

  async selectListView(viewName: string): Promise<void> {
    const viewPicker = this.page.locator('button[title*="Select a List View"], a[title*="Select a List View"]').first();
    await viewPicker.click();
    await this.page.getByRole('option', { name: viewName, exact: false }).click();
    await waitForPageReady(this.page);
    await waitForSalesforceNetwork(this.page);
  }

  async getCurrentListViewName(): Promise<string> {
    const header = this.page.locator(`${LIST_VIEW.manager} h1, h1[class*="slds-page-header"]`).first();
    return (await header.textContent({ timeout: 5_000 }))?.trim() || '';
  }

  // ── Search ────────────────────────────────────────────────

  async searchInListView(searchTerm: string): Promise<void> {
    await retryAction(async () => {
      const searchInput = this.page.locator(
        `${LIST_VIEW.searchInput} input, input[placeholder*="Search this list"], input[name="search-input"]`
      ).first();
      await searchInput.click();
      await searchInput.fill(searchTerm);
      await this.page.keyboard.press('Enter');
      await waitForSalesforceNetwork(this.page);
      await waitForSpinner(this.page);
    }, 2, 500);
  }

  async clearSearch(): Promise<void> {
    const clearBtn = this.page.locator('button[title="Clear"], button[aria-label="Clear"]').first();
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await waitForSalesforceNetwork(this.page);
    }
  }

  // ── Row Interactions ──────────────────────────────────────

  async getRowCount(tableIdentifier?: string): Promise<number> {
    const table = tableIdentifier
      ? this.page.locator('table, lightning-datatable').filter({ hasText: tableIdentifier })
      : this.page.locator(`${LIST_VIEW.table} tbody, table tbody, lightning-datatable`).first();
    const rows = table.locator('tr[data-row-key-value], tbody tr');
    return rows.count();
  }

  async getColumnValues(columnName: string): Promise<string[]> {
    const values: string[] = [];
    // Find the column index by header name
    const headers = this.page.locator('table thead th, lightning-datatable th');
    const headerCount = await headers.count();
    let colIndex = -1;

    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text?.trim().includes(columnName)) {
        colIndex = i;
        break;
      }
    }

    if (colIndex === -1) return values;

    const rows = this.page.locator('table tbody tr, lightning-datatable tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const cells = rows.nth(i).locator('td, th');
      const cellText = await cells.nth(colIndex).textContent().catch(() => '');
      if (cellText?.trim()) values.push(cellText.trim());
    }

    return values;
  }

  async clickRow(rowIndex: number): Promise<void> {
    const rows = this.page.locator('table tbody tr, lightning-datatable tbody tr');
    await rows.nth(rowIndex).click();
    await waitForPageReady(this.page);
  }

  async clickRowByText(text: string): Promise<void> {
    const row = this.page.locator('table tbody tr, lightning-datatable tbody tr').filter({
      hasText: text,
    }).first();
    await row.locator('a, th a').first().click();
    await waitForPageReady(this.page);
  }

  async assertRowExists(columnText: string, value: string): Promise<boolean> {
    const row = this.page.locator('table tbody tr, lightning-datatable tbody tr').filter({
      hasText: value,
    });
    return (await row.count()) > 0;
  }

  // ── Row Selection ─────────────────────────────────────────

  async selectRows(rowIndices: number[]): Promise<void> {
    for (const idx of rowIndices) {
      const checkbox = this.page.locator(
        'table tbody tr, lightning-datatable tbody tr',
      ).nth(idx).locator('input[type="checkbox"], lightning-primitive-cell-checkbox input').first();
      await checkbox.check();
    }
  }

  async selectAllRows(): Promise<void> {
    const headerCheckbox = this.page.locator(
      'table thead input[type="checkbox"], lightning-datatable thead input[type="checkbox"]',
    ).first();
    await headerCheckbox.check();
  }

  async deselectAllRows(): Promise<void> {
    const headerCheckbox = this.page.locator(
      'table thead input[type="checkbox"], lightning-datatable thead input[type="checkbox"]',
    ).first();
    await headerCheckbox.uncheck();
  }

  // ── Mass Actions ──────────────────────────────────────────

  async clickMassAction(actionName: string): Promise<void> {
    // Mass actions appear after selecting rows
    await this.page.getByRole('button', { name: actionName, exact: false }).click();
    await waitForSalesforceNetwork(this.page);
  }

  async getMassActionOptions(): Promise<string[]> {
    const actions = this.page.locator('runtime_platform_actions-list-action-menu, button[name*="action"]');
    const out: string[] = [];
    const n = await actions.count();
    for (let i = 0; i < n; i++) {
      const text = await actions.nth(i).textContent();
      if (text?.trim()) out.push(text.trim());
    }
    return out;
  }

  // ── Sorting ───────────────────────────────────────────────

  async sortByColumn(columnName: string): Promise<void> {
    const header = this.page.locator('table thead th, lightning-datatable th').filter({
      hasText: columnName,
    }).first();
    await header.click();
    await waitForSalesforceNetwork(this.page);
  }

  // ── Pagination ────────────────────────────────────────────

  async getRecordCountText(): Promise<string> {
    const countEl = this.page.locator(
      'span[class*="countSortedByFilter"], .slds-text-body_small, span.count',
    ).first();
    return (await countEl.textContent().catch(() => ''))?.trim() || '';
  }

  async clickNextPage(): Promise<void> {
    await this.page.getByRole('button', { name: /next/i }).click();
    await waitForSalesforceNetwork(this.page);
  }

  async clickPreviousPage(): Promise<void> {
    await this.page.getByRole('button', { name: /previous/i }).click();
    await waitForSalesforceNetwork(this.page);
  }

  // ── New Record from List View ─────────────────────────────

  async clickNewButton(): Promise<void> {
    await this.page.getByRole('button', { name: /^new$/i }).first().click();
    await waitForPageReady(this.page);
  }
}
