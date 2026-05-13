import type { Page } from '@playwright/test';
import { waitForPageReady, waitForSpinner, waitForSalesforceNetwork, retryAction } from '../utils/sf-helpers';
import { FLOW, LIGHTNING, SLDS, getFlowInput, getFlowNavigationButton } from '../utils/selectors';

export class ScreenFlow {
  constructor(private page: Page) {}

  async getCurrentScreenTitle(): Promise<string> {
    try {
      const header = this.page.locator(`${FLOW.header}, flowruntime-screen-field[type="DISPLAY_TEXT"]`).first();
      const text = await header.textContent({ timeout: 5_000 });
      return text?.trim() || '';
    } catch {
      return '';
    }
  }

  async fillInput(label: string, value: string): Promise<void> {
    await retryAction(async () => {
      const input = getFlowInput(this.page, label);
      const inputField = input.locator('input, textarea').first();
      await inputField.click();
      await inputField.fill(value);
    }, 2, 500);
  }

  async selectOption(label: string, value: string): Promise<void> {
    await retryAction(async () => {
      const combobox = this.page.locator(FLOW.screen).locator(LIGHTNING.combobox, {
        has: this.page.getByText(label),
      });
      await combobox.click();
      await this.page.getByRole('option', { name: value, exact: false }).click();
      await waitForSpinner(this.page, 5_000);
      await waitForSalesforceNetwork(this.page, { settleMs: 300 });
    }, 3, 500);
  }

  async selectRadio(label: string, value: string): Promise<void> {
    await retryAction(async () => {
      const radioGroup = this.page.locator(FLOW.screen).locator(LIGHTNING.radioGroup, {
        has: this.page.getByText(label),
      });
      await radioGroup.getByLabel(value).click();
    }, 2, 500);
  }

  async checkCheckbox(label: string): Promise<void> {
    await retryAction(async () => {
      const checkbox = this.page.locator(FLOW.screen).getByLabel(label);
      if (!(await checkbox.isChecked())) {
        await checkbox.check();
      }
    }, 2, 500);
  }

  async uncheckCheckbox(label: string): Promise<void> {
    await retryAction(async () => {
      const checkbox = this.page.locator(FLOW.screen).getByLabel(label);
      if (await checkbox.isChecked()) {
        await checkbox.uncheck();
      }
    }, 2, 500);
  }

  async fillDate(label: string, value: string): Promise<void> {
    await retryAction(async () => {
      const dateInput = this.page.locator(FLOW.screen).locator(LIGHTNING.datepicker, {
        has: this.page.getByText(label),
      }).locator('input').first();

      await dateInput.click();
      await dateInput.fill(value);
      await this.page.keyboard.press('Tab');
    }, 2, 500);
  }

  async fillLookup(label: string, searchTerm: string): Promise<void> {
    await retryAction(async () => {
      const lookup = this.page.locator(FLOW.screen).locator(LIGHTNING.lookup, {
        has: this.page.getByText(label),
      }).locator('input').first();

      await lookup.click();
      await lookup.fill(searchTerm);
      await this.page.waitForTimeout(1_000);
      await this.page.getByRole('option', { name: searchTerm, exact: false }).first().click();
      await waitForSalesforceNetwork(this.page, { settleMs: 300 });
    }, 3, 500);
  }

  async clickNext(): Promise<void> {
    await retryAction(async () => {
      await getFlowNavigationButton(this.page, 'Next').click();
      await waitForSpinner(this.page);
      await waitForSalesforceNetwork(this.page);
      await waitForPageReady(this.page);
    }, 2, 500);
  }

  async clickPrevious(): Promise<void> {
    await retryAction(async () => {
      await getFlowNavigationButton(this.page, 'Previous').click();
      await waitForSpinner(this.page);
      await waitForPageReady(this.page);
    }, 2, 500);
  }

  async clickFinish(): Promise<void> {
    await retryAction(async () => {
      await getFlowNavigationButton(this.page, 'Finish').click();
      await waitForSpinner(this.page);
      await waitForSalesforceNetwork(this.page);
      await waitForPageReady(this.page);
    }, 2, 500);
  }

  async clickPause(): Promise<void> {
    await retryAction(async () => {
      await getFlowNavigationButton(this.page, 'Pause').click();
      await waitForSpinner(this.page);
    }, 2, 500);
  }

  async getErrorMessages(): Promise<string[]> {
    const errors: string[] = [];
    const errorElements = this.page.locator(
      `${FLOW.screen} ${SLDS.formElementError}, ` +
      `${FLOW.screen} .flowruntimeError, ` +
      `flowruntime-display-text-lwc .slds-text-color_error`
    );

    const count = await errorElements.count();
    for (let i = 0; i < count; i++) {
      const text = await errorElements.nth(i).textContent();
      if (text?.trim()) errors.push(text.trim());
    }
    return errors;
  }

  async getVisibleFields(): Promise<string[]> {
    const labels: string[] = [];
    const fields = this.page.locator(
      `${FLOW.screen} ${SLDS.formElementLabel}, ` +
      `${FLOW.screen} label`
    );

    const count = await fields.count();
    for (let i = 0; i < count; i++) {
      const text = await fields.nth(i).textContent();
      if (text?.trim()) labels.push(text.trim());
    }
    return labels;
  }

  async isFieldRequired(label: string): Promise<boolean> {
    const field = getFlowInput(this.page, label);
    const required = field.locator(SLDS.requiredAbbr);
    try {
      return (await required.count()) > 0;
    } catch {
      return false;
    }
  }

  async getScreenCount(): Promise<number> {
    const progress = this.page.locator('flowruntime-progress-indicator lightning-progress-step');
    return await progress.count();
  }

  async waitForScreen(expectedTitle: string, timeout = 10_000): Promise<void> {
    await this.page.waitForFunction(
      (title: string) => {
        const headers = document.querySelectorAll(
          'flowruntime-screen-header, h2, [data-component-id]'
        );
        return Array.from(headers).some((h) =>
          h.textContent?.includes(title)
        );
      },
      expectedTitle,
      { timeout }
    );
  }

  async uploadFile(label: string, filePath: string): Promise<void> {
    await retryAction(async () => {
      const input = this.page.locator(`${FLOW.screen} input[type="file"]`).first();
      await input.setInputFiles(filePath);
      await waitForSpinner(this.page);
    }, 2, 500);
  }

  async fillDataTableRow(
    tableLabel: string,
    rowIndex: number,
    values: Record<string, string>,
  ): Promise<void> {
    await retryAction(async () => {
      const table = this.page.locator(FLOW.screen).locator('lightning-datatable, table').filter({
        has: this.page.getByText(tableLabel, { exact: false }),
      });
      for (const [col, val] of Object.entries(values)) {
        const cell = table.locator(`[data-col-key-value="${col}"], td`).nth(rowIndex);
        await cell.locator('input, textarea').first().fill(val).catch(async () => {
          await cell.click();
          await this.page.keyboard.type(val);
        });
      }
      await waitForSpinner(this.page);
    }, 2, 500);
  }

  async getDataTableRowCount(tableLabel: string): Promise<number> {
    const table = this.page.locator(FLOW.screen).locator('lightning-datatable, table').filter({
      has: this.page.getByText(tableLabel, { exact: false }),
    });
    const rows = table.locator('tbody tr, [role="row"]');
    return rows.count();
  }

  async hasFlowError(): Promise<boolean> {
    const err = this.page.locator('.flowruntimeError, .slds-text-color_error').first();
    return err.isVisible().catch(() => false);
  }

  async getFlowFaultMessage(): Promise<string> {
    const err = this.page.locator('.flowruntimeError, [data-flow-error]').first();
    return (await err.textContent().catch(() => ''))?.trim() || '';
  }

  async fillPauseReason(reason: string): Promise<void> {
    await this.page.getByLabel(/reason|pause/i).fill(reason);
  }

  async getChoiceOptions(label: string): Promise<string[]> {
    return retryAction(async () => {
      const combo = this.page.locator(FLOW.screen).locator(LIGHTNING.combobox, {
        has: this.page.getByText(label, { exact: false }),
      });
      await combo.click();
      const opts = this.page.locator('lightning-base-combobox-item');
      const n = await opts.count();
      const out: string[] = [];
      for (let i = 0; i < n; i++) {
        const t = await opts.nth(i).textContent();
        if (t?.trim()) out.push(t.trim());
      }
      await this.page.keyboard.press('Escape');
      return out;
    }, 2, 500);
  }

  async getCurrentStepIndex(): Promise<number> {
    const active = this.page.locator('lightning-progress-step[aria-current="step"], .slds-is-active');
    const idx = await active.first().getAttribute('data-step-index').catch(() => null);
    return idx ? parseInt(idx, 10) : 0;
  }

  async getTotalSteps(): Promise<number> {
    return this.page.locator('lightning-progress-step, flowruntime-progress-indicator *').count();
  }
}
