import type { Page, Locator } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
// Tier 1: Role-based accessibility selectors (most stable)
// ═══════════════════════════════════════════════════════════

export function getFieldByLabel(page: Page, label: string): Locator {
  return page.getByLabel(label, { exact: false });
}

export function getButtonByName(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: false });
}

export function getHeading(page: Page, name: string): Locator {
  return page.getByRole('heading', { name, exact: false });
}

export function getLinkByName(page: Page, name: string): Locator {
  return page.getByRole('link', { name, exact: false });
}

export function getTabByName(page: Page, name: string): Locator {
  return page.getByRole('tab', { name, exact: false });
}

export function getMenuItemByName(page: Page, name: string): Locator {
  return page.getByRole('menuitem', { name, exact: false });
}

export function getTextOnPage(page: Page, text: string): Locator {
  return page.getByText(text, { exact: false });
}

// ═══════════════════════════════════════════════════════════
// Tier 2: Lightning component tag selectors (stable)
// ═══════════════════════════════════════════════════════════

export const LIGHTNING = {
  input: 'lightning-input',
  textarea: 'lightning-textarea',
  combobox: 'lightning-combobox',
  datepicker: 'lightning-datepicker',
  lookup: 'lightning-lookup',
  checkboxGroup: 'lightning-checkbox-group',
  radioGroup: 'lightning-radio-group',
  dualListbox: 'lightning-dual-listbox',
  richTextEditor: 'lightning-input-rich-text',
  spinner: 'lightning-spinner',
  modal: 'lightning-modal',
  tab: 'lightning-tab',
  tabBar: 'lightning-tab-bar',
  tabSet: 'lightning-tabset',
  accordion: 'lightning-accordion',
  accordionSection: 'lightning-accordion-section',
  card: 'lightning-card',
  icon: 'lightning-icon',
  badge: 'lightning-badge',
  pill: 'lightning-pill',
  outputField: 'lightning-output-field',
  inputField: 'lightning-input-field',
  formattedText: 'lightning-formatted-text',
  formattedUrl: 'lightning-formatted-url',
  formattedEmail: 'lightning-formatted-email',
  formattedPhone: 'lightning-formatted-phone',
  formattedNumber: 'lightning-formatted-number',
  formattedDateTime: 'lightning-formatted-date-time',
  buttonIcon: 'lightning-button-icon',
  buttonMenu: 'lightning-button-menu',
  helptext: 'lightning-helptext',
  fileUpload: 'lightning-file-upload',
} as const;

export const RECORD_PAGE = {
  section: 'records-record-layout-section',
  layoutItem: 'records-record-layout-item',
  highlightFields: 'force-highlights-details-item',
  recordForm: 'records-record-edit-form',
  outputField: 'records-output-field',
  formSection: 'records-record-layout-section',
  /** Dynamic Forms — field container (replaces layoutItem on Dynamic Forms pages) */
  dynamicField: 'records-record-layout-event-broker, record_flexipage-record-field, records-record-layout-base-input',
  /** Dynamic Forms — section wrapper */
  dynamicSection: 'record_flexipage-desktop-record-section',
} as const;

export const FLOW = {
  runtime: 'flowruntime-flow',
  screen: 'flowruntime-lwc-body',
  navigation: 'flowruntime-navigation-bar',
  inputField: 'flowruntime-input-field',
  header: 'flowruntime-screen-header',
} as const;

export const LIST_VIEW = {
  manager: 'lst-list-view-manager-header',
  table: 'lst-formatted-output-table',
  searchInput: 'lst-list-search-bar',
  row: 'tr[data-row-key-value]',
  cell: 'td[data-label]',
} as const;

// ═══════════════════════════════════════════════════════════
// Tier 3: SLDS design system classes (mostly stable)
//   Updated: uses underscore BEM modifiers (current standard)
//   instead of deprecated double-dash notation
// ═══════════════════════════════════════════════════════════

export const SLDS = {
  modal: '.slds-modal__container',
  modalBackdrop: '.slds-backdrop',
  spinner: '.slds-spinner',
  /** Toast container — supports both deprecated (--) and current (_) BEM */
  toast: '.slds-notify_toast, .slds-notify--toast',
  /** Toast message text — use both class patterns for cross-release compat */
  toastMessage: '.toastMessage, .slds-notify__content, force-aloha-page .toastMessage',
  pageHeader: '.slds-page-header',
  card: '.slds-card',
  formElement: '.slds-form-element',
  formElementLabel: '.slds-form-element__label',
  formElementControl: '.slds-form-element__control',
  formElementError: '.slds-form-element__help',
  /** Page-level error banner (validation / DML failures) */
  pageError: '.pageLevelErrors, .slds-notify_alert, force-aloha-page .errorContainer',
  buttonGroup: '.slds-button-group',
  dropdown: '.slds-dropdown',
  dropdownItem: '.slds-dropdown__item',
  requiredAbbr: 'abbr.slds-required',
  pillContainer: '.slds-pill_container, .slds-pill--container',
} as const;

// ═══════════════════════════════════════════════════════════
// Helper functions for common selector patterns
// ═══════════════════════════════════════════════════════════

/**
 * Get a record field container by label — supports both classic record layouts
 * and Dynamic Forms (record_flexipage-record-field).
 */
export function getRecordField(page: Page, fieldLabel: string): Locator {
  return page.locator(
    `${RECORD_PAGE.layoutItem}, ${RECORD_PAGE.dynamicField}`,
    {
      has: page.getByText(fieldLabel, { exact: true }),
    },
  );
}

export function getRecordSection(page: Page, sectionTitle: string): Locator {
  return page.locator(`${RECORD_PAGE.section}, ${RECORD_PAGE.dynamicSection}`, {
    has: page.getByText(sectionTitle),
  });
}

export function getPicklistCombobox(page: Page, label: string): Locator {
  return page.locator(LIGHTNING.combobox, {
    has: page.getByText(label),
  });
}

export function getLightningInput(page: Page, label: string): Locator {
  return page.locator(LIGHTNING.input, {
    has: page.getByText(label),
  });
}

export function getFlowInput(page: Page, label: string): Locator {
  return page.locator(FLOW.screen).locator(`${LIGHTNING.input}, ${LIGHTNING.combobox}, ${LIGHTNING.textarea}`, {
    has: page.getByText(label),
  });
}

export function getFlowNavigationButton(page: Page, buttonName: string): Locator {
  return page.locator(FLOW.navigation).getByRole('button', { name: buttonName });
}

export function isFieldRequired(page: Page, fieldLabel: string): Locator {
  return getRecordField(page, fieldLabel).locator(SLDS.requiredAbbr);
}

export function getErrorMessages(page: Page): Locator {
  return page.locator(`${SLDS.formElementError}, .form-error, [data-error-message], ${SLDS.pageError}`);
}

export function getNavBarTabs(page: Page): Locator {
  return page.locator('one-app-nav-bar-item-root');
}

export function getNavBarTab(page: Page, tabLabel: string): Locator {
  return page.locator('one-app-nav-bar-item-root', {
    has: page.getByText(tabLabel, { exact: true }),
  });
}

export function getRelatedList(page: Page, listTitle: string): Locator {
  return page.locator('lst-related-list-single-container, force-related-list-single-container', {
    has: page.getByText(listTitle),
  });
}

export function getQuickAction(page: Page, actionLabel: string): Locator {
  return page.locator('runtime_platform_actions-action-renderer', {
    has: page.getByText(actionLabel),
  });
}

/** Strip known namespace prefixes for display/compare (does not validate org namespaces). */
export function normalizeFieldApiName(fieldApiName: string, namespaces: string[]): string {
  let out = fieldApiName;
  for (const ns of namespaces) {
    const p = `${ns}__`;
    if (out.toLowerCase().startsWith(p.toLowerCase())) {
      out = out.slice(p.length);
      break;
    }
  }
  return out;
}
