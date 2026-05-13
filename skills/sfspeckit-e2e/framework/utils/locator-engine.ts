/**
 * locator-engine.ts — Next-Gen Salesforce Locator Engine
 *
 * This represents the shift away from brittle CSS selectors (e.g., SLDS classes)
 * toward dynamic, metadata-driven and shadow-piercing locators.
 *
 * It acts as an abstraction layer that:
 * 1. Deeply pierces Shadow DOM boundaries (crucial for LWC / Redwood UI).
 * 2. Uses text and aria attributes as the ultimate source of truth, minimizing
 *    reliance on exact HTML tag names (e.g., lightning-input vs c-custom-input).
 * 3. Can be seeded with Tooling API metadata to precisely target fields.
 */

import type { Page, Locator, Frame } from '@playwright/test';
import { IframeEngine } from './iframe-engine';

export interface FieldMetadata {
  apiName: string;
  label: string;
  type: string; // 'string', 'picklist', 'reference', 'boolean', 'datetime'
  isReadOnly: boolean;
  isRequired: boolean;
}

export class DynamicLocatorEngine {
  constructor(private page: Page) {}

  /**
   * Universal shadow-piercing field locator.
   * Instead of depending on SLDS classes, it finds the label text across any
   * shadow boundary, navigates up to the logical container, and extracts the input.
   *
   * This survives the transition from Aura -> LWC -> Redwood UI.
   */
  async locateInputByLabel(label: string): Promise<Locator> {
    return IframeEngine.findVisibleLocator(this.page, async (root: Page | Frame) => {
      // 1. First attempt: Standard semantic accessibility
      const ariaLocator = root.getByLabel(label, { exact: false });
      if (await ariaLocator.first().isVisible().catch(() => false)) {
        return ariaLocator.first();
      }

      // 2. Second attempt: Shadow-DOM piercing layout item finding
      const genericFieldContainer = root.locator(
        'lightning-layout-item, force-record-layout-item, records-record-layout-item, flexipage-field, c-custom-field'
      ).filter({ hasText: new RegExp(`^${label}\\*?$`, 'i') });

      if (await genericFieldContainer.first().isVisible().catch(() => false)) {
        return genericFieldContainer.first().locator('input, textarea, select, button[role="combobox"]').first();
      }

      // 3. Fallback: Brute force shadow dom text search and next sibling/parent input
      const labelEl = root.getByText(label, { exact: true }).first();
      if (await labelEl.isVisible().catch(() => false)) {
        const parentContainer = labelEl.locator('..').locator('..'); // Traverse up to logical boundary
        return parentContainer.locator('input, textarea, button[role="combobox"]').first();
      }
      
      return null;
    });
  }

  /**
   * Future implementation stub for true Metadata-Driven UI locating.
   * In a future release, SFSpeckit will pull the PageLayout metadata for the object,
   * find which section/column the field is in, and dynamically construct a highly
   * specific layout-based locator.
   */
  async locateByMetadata(metadata: FieldMetadata, sectionName?: string): Promise<Locator> {
    return IframeEngine.findVisibleLocator(this.page, async (root: Page | Frame) => {
      let rootLocator = root.locator('body');
      
      if (sectionName) {
        rootLocator = root.locator('lightning-accordion-section, records-record-layout-section').filter({
          hasText: sectionName
        }).first();
      }

      let inputTag = 'input';
      switch (metadata.type) {
        case 'picklist':
        case 'reference':
          inputTag = 'button[role="combobox"], input[role="combobox"]';
          break;
        case 'boolean':
          inputTag = 'input[type="checkbox"]';
          break;
        case 'textarea':
          inputTag = 'textarea';
          break;
      }

      const fieldContainer = rootLocator.locator('records-record-layout-item, flexipage-field').filter({
        hasText: metadata.label
      });

      const target = fieldContainer.locator(inputTag).first();
      return await target.isVisible().catch(() => false) ? target : null;
    });
  }
}
