import type { Page, Locator } from '@playwright/test';
import { waitForPageReady, waitForSpinner, waitForSalesforceNetwork, captureScreenshot, retryAction } from '../utils/sf-helpers';
import {
  getFieldByLabel,
  getButtonByName,
  getRecordField,
  getRecordSection,
  getPicklistCombobox,
  getRelatedList,
  LIGHTNING,
  RECORD_PAGE,
  SLDS,
} from '../utils/selectors';

export class RecordPage {
  constructor(private page: Page) {}

  async fillField(label: string, value: string): Promise<void> {
    await this.ensureFieldVisible(label);
    const field = getFieldByLabel(this.page, label);
    await field.click();
    await field.fill(value);
  }

  async selectPicklist(label: string, value: string): Promise<void> {
    await this.ensureFieldVisible(label);
    await retryAction(async () => {
      const combobox = getPicklistCombobox(this.page, label);
      await combobox.click();
      await this.page.getByRole('option', { name: value, exact: false }).click();
      await waitForSpinner(this.page, 5_000);
      await waitForSalesforceNetwork(this.page, { settleMs: 300 });
    }, 3, 500);
  }

  async getPicklistOptions(label: string): Promise<string[]> {
    const combobox = getPicklistCombobox(this.page, label);
    await combobox.click();

    const options = this.page.locator(`${LIGHTNING.combobox} lightning-base-combobox-item`);
    const texts: string[] = [];
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text?.trim()) texts.push(text.trim());
    }

    await this.page.keyboard.press('Escape');
    return texts;
  }

  async getFieldValue(label: string): Promise<string> {
    await this.ensureFieldVisible(label);
    const field = getRecordField(this.page, label);
    const outputField = field.locator(
      `${LIGHTNING.outputField}, ${RECORD_PAGE.outputField}, ${LIGHTNING.formattedText}, ` +
      `${LIGHTNING.formattedUrl}, ${LIGHTNING.formattedEmail}, ${LIGHTNING.formattedPhone}`
    );

    try {
      return (await outputField.first().textContent({ timeout: 5_000 }))?.trim() || '';
    } catch {
      return '';
    }
  }

  async isFieldVisible(label: string): Promise<boolean> {
    try {
      // Check both classic layout and Dynamic Forms record field containers
      const classicField = getRecordField(this.page, label);
      const dynamicField = this.page.locator(
        `${RECORD_PAGE.dynamicField}, ${RECORD_PAGE.layoutItem}`,
      ).filter({ hasText: label });

      const classicVisible = await classicField.isVisible({ timeout: 3_000 }).catch(() => false);
      if (classicVisible) return true;

      return await dynamicField.first().isVisible({ timeout: 3_000 }).catch(() => false);
    } catch {
      return false;
    }
  }

  /**
   * Auto-navigates the UI to reveal a hidden field.
   * Clicks unselected tabs or expands accordions if the field isn't immediately visible.
   */
  private async ensureFieldVisible(label: string): Promise<void> {
    const isVisibleNow = await this.isFieldVisible(label);
    if (isVisibleNow) return;

    // 1. Try expanding collapsed accordions
    const accordions = this.page.locator('lightning-accordion-section[class*="slds-is-collapsed"] button');
    const accCount = await accordions.count();
    for (let i = 0; i < accCount; i++) {
      await accordions.nth(i).click().catch(() => {});
      await this.page.waitForTimeout(300);
      if (await this.isFieldVisible(label)) return;
    }

    // 2. Try clicking other unselected tabs (Details, Related, Custom)
    const tabs = this.page.locator('a[role="tab"][aria-selected="false"], lightning-tab-bar li:not(.slds-is-active) a');
    const tabCount = await tabs.count();
    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click().catch(() => {});
      await this.page.waitForTimeout(500);
      if (await this.isFieldVisible(label)) return;
    }
  }

  /**
   * Check if a field is editable WITHOUT modifying page state.
   * Detects current mode (view/edit) and only enters edit mode if necessary,
   * always restoring the page to its original state afterward.
   */
  async isFieldEditable(label: string): Promise<boolean> {
    // Check if we're already in edit mode by looking for save/cancel buttons
    const alreadyInEditMode = await this.page
      .locator('button[name="SaveEdit"], button.slds-button[title="Save"]')
      .first()
      .isVisible({ timeout: 1_000 })
      .catch(() => false);

    try {
      if (!alreadyInEditMode) {
        await this.clickEdit();
        await waitForPageReady(this.page);
      }

      const input = getFieldByLabel(this.page, label);
      const isVisible = await input.isVisible({ timeout: 5_000 });
      if (!isVisible) return false;

      const isDisabled = await input.isDisabled();
      return !isDisabled;
    } catch {
      return false;
    } finally {
      // Restore original page state: cancel edit only if we entered it
      if (!alreadyInEditMode) {
        await this.clickCancel().catch(() => {});
      }
    }
  }

  async isFieldRequired(label: string): Promise<boolean> {
    const field = getRecordField(this.page, label);
    const required = field.locator(SLDS.requiredAbbr);
    try {
      return (await required.count()) > 0;
    } catch {
      return false;
    }
  }

  async clickSave(): Promise<void> {
    await retryAction(async () => {
      await getButtonByName(this.page, 'Save').click();
      await waitForSpinner(this.page);
      await waitForSalesforceNetwork(this.page);
      await waitForPageReady(this.page);
    }, 2, 500);
  }

  async clickEdit(): Promise<void> {
    await retryAction(async () => {
      try {
        const pencilBtn = this.page.locator('button[name="Edit"]').first();
        if (await pencilBtn.isVisible({ timeout: 3_000 })) {
          await pencilBtn.click();
          await waitForPageReady(this.page);
          return;
        }
      } catch {
        // fall through
      }

      await getButtonByName(this.page, 'Edit').click();
      await waitForPageReady(this.page);
    }, 2, 500);
  }

  async clickDelete(): Promise<void> {
    const actions = this.page.locator('lightning-button-menu[slot="actions"]').first();
    await actions.click();
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();

    const confirmBtn = this.page.locator(SLDS.modal).getByRole('button', { name: 'Delete' });
    await confirmBtn.click();
    await waitForSpinner(this.page);
    await waitForSalesforceNetwork(this.page);
  }

  async clickCancel(): Promise<void> {
    await getButtonByName(this.page, 'Cancel').click();
    await waitForPageReady(this.page);
  }

  async getErrorMessage(): Promise<string> {
    try {
      const pageError = this.page.locator(
        `${SLDS.formElementError}, .pageLevelErrors li, ` +
        `force-record-layout-section .slds-text-color_error, ` +
        `${SLDS.pageError}`
      ).first();
      await pageError.waitFor({ state: 'visible', timeout: 5_000 });
      return (await pageError.textContent())?.trim() || '';
    } catch {
      return '';
    }
  }

  async getAllErrorMessages(): Promise<string[]> {
    const errors: string[] = [];
    const errorElements = this.page.locator(
      `${SLDS.formElementError}, .pageLevelErrors li, ${SLDS.pageError}`
    );

    const count = await errorElements.count();
    for (let i = 0; i < count; i++) {
      const text = await errorElements.nth(i).textContent();
      if (text?.trim()) errors.push(text.trim());
    }
    return errors;
  }

  async getToastMessage(): Promise<string> {
    return retryAction(async () => {
      const toast = this.page.locator(`${SLDS.toast}, ${SLDS.toastMessage}`).first();
      await toast.waitFor({ state: 'visible', timeout: 10_000 });
      return (await toast.textContent())?.trim() || '';
    }, 2, 500);
  }

  async fillLookup(label: string, searchTerm: string): Promise<void> {
    await this.ensureFieldVisible(label);
    await retryAction(async () => {
      const lookupInput = getFieldByLabel(this.page, label);
      await lookupInput.click();
      await lookupInput.fill(searchTerm);

      await this.page.waitForTimeout(1_000);
      const option = this.page.getByRole('option', { name: searchTerm, exact: false }).first();
      await option.click();
      await waitForSpinner(this.page, 5_000);
      await waitForSalesforceNetwork(this.page, { settleMs: 300 });
    }, 3, 500);
  }

  async getVisibleFields(): Promise<string[]> {
    const items = this.page.locator(`${RECORD_PAGE.layoutItem}, ${RECORD_PAGE.dynamicField}`);
    const fields: string[] = [];
    const count = await items.count();

    for (let i = 0; i < count; i++) {
      const labelEl = items.nth(i).locator(SLDS.formElementLabel).first();
      try {
        const label = await labelEl.textContent({ timeout: 2_000 });
        if (label?.trim()) fields.push(label.trim());
      } catch {
        // skip unlabeled items
      }
    }

    return fields;
  }

  async getSections(): Promise<string[]> {
    const sections = this.page.locator(RECORD_PAGE.section);
    const names: string[] = [];
    const count = await sections.count();

    for (let i = 0; i < count; i++) {
      const heading = sections.nth(i).getByRole('heading').first();
      try {
        const name = await heading.textContent({ timeout: 2_000 });
        if (name?.trim()) names.push(name.trim());
      } catch {
        // skip unnamed sections
      }
    }

    return names;
  }

  async getRelatedLists(): Promise<string[]> {
    const relatedLists = this.page.locator(
      'lst-related-list-single-container, force-related-list-single-container'
    );
    const names: string[] = [];
    const count = await relatedLists.count();

    for (let i = 0; i < count; i++) {
      const heading = relatedLists.nth(i).getByRole('heading').first();
      try {
        const name = await heading.textContent({ timeout: 2_000 });
        if (name?.trim()) names.push(name.trim());
      } catch {
        // skip
      }
    }

    return names;
  }

  async getHighlightsFieldValues(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const items = this.page.locator(`${RECORD_PAGE.highlightFields}, force-highlights-details-item`);
    const n = await items.count();
    for (let i = 0; i < n; i++) {
      const row = items.nth(i);
      const label = await row.locator('.slds-text-title, dt').first().textContent().catch(() => '');
      const val = await row.locator('dd, lightning-formatted-text').first().textContent().catch(() => '');
      if (label?.trim()) out[label.trim()] = (val || '').trim();
    }
    return out;
  }

  async isHighlightsFieldVisible(label: string): Promise<boolean> {
    const el = this.page.locator(RECORD_PAGE.highlightFields).filter({ hasText: label });
    return el.first().isVisible().catch(() => false);
  }

  async clickClone(): Promise<void> {
    await this.page.getByRole('button', { name: /clone/i }).click();
    await waitForPageReady(this.page);
  }

  async inlineEdit(fieldLabel: string, newValue: string): Promise<void> {
    const field = getRecordField(this.page, fieldLabel);
    await field.locator('button.inline-edit-trigger, button[title="Edit"]').first().click().catch(async () => {
      await this.clickEdit();
    });
    await waitForPageReady(this.page);
    await this.fillField(fieldLabel, newValue);
    await this.clickSave();
  }

  async clickRelatedListNewButton(relatedListName: string): Promise<void> {
    const rl = getRelatedList(this.page, relatedListName);
    await rl.getByRole('button', { name: /new/i }).first().click();
    await waitForPageReady(this.page);
  }

  async getRelatedListRecordCount(relatedListName: string): Promise<number> {
    const rl = getRelatedList(this.page, relatedListName);
    const rows = rl.locator('tbody tr, tr[data-row-key-value]');
    return rows.count();
  }

  async getAvailableActions(): Promise<string[]> {
    const menu = this.page.locator('lightning-button-menu[slot="actions"]').first();
    await menu.click();
    const items = this.page.locator('lightning-menu-item, a.menuitem');
    const n = await items.count();
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = await items.nth(i).textContent();
      if (t?.trim()) out.push(t.trim());
    }
    await this.page.keyboard.press('Escape');
    return out;
  }

  async clickAction(actionName: string): Promise<void> {
    const menu = this.page.locator('lightning-button-menu[slot="actions"]').first();
    await menu.click();
    await this.page.getByRole('menuitem', { name: actionName }).click();
    await waitForSpinner(this.page);
    await waitForSalesforceNetwork(this.page);
  }

  async getRecordOwner(): Promise<string> {
    const owner = this.page.locator('[data-field-id="OwnerId"], records-record-layout-item').filter({
      hasText: /owner/i,
    });
    return (await owner.locator('.test-id__field-value').first().textContent().catch(() => ''))?.trim() || '';
  }

  async getFieldHelpText(label: string): Promise<string> {
    const field = getRecordField(this.page, label);
    const help = field.locator(LIGHTNING.helptext);
    return (await help.getAttribute('title').catch(() => '')) || '';
  }

  async getFieldDefaultValue(label: string): Promise<string> {
    // Detect if we're already in edit mode to avoid side effects
    const alreadyInEditMode = await this.page
      .locator('button[name="SaveEdit"], button.slds-button[title="Save"]')
      .first()
      .isVisible({ timeout: 1_000 })
      .catch(() => false);

    try {
      if (!alreadyInEditMode) {
        await this.clickEdit();
        await waitForPageReady(this.page);
      }

      const input = getFieldByLabel(this.page, label);
      const v = await input.inputValue().catch(async () => {
        return (await input.textContent())?.trim() || '';
      });
      return v || '';
    } catch {
      return '';
    } finally {
      // Restore original page state: cancel edit only if we entered it
      if (!alreadyInEditMode) {
        await this.clickCancel().catch(() => {});
      }
    }
  }
}
