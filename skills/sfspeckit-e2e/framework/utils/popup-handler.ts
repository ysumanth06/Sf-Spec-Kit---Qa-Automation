import type { Page } from '@playwright/test';

const installed = new WeakSet<Page>();

/**
 * popup-handler.ts — Aggressive "Chaos" Handler for Salesforce Modals
 *
 * Injects a MutationObserver into the page to aggressively detect and close
 * non-test-related modals (Guidance Center, Surveys, Session Timeouts, Tours)
 * the moment they appear, before they can intercept Playwright clicks.
 */
export async function installPopupHandler(page: Page): Promise<void> {
  if (installed.has(page)) return;
  installed.add(page);

  await page.addInitScript(() => {
    // Selectors for common annoying Salesforce popups
    const POPUP_SELECTORS = [
      // Setup Assistant / Tour
      '.forceSetupAssistantDialog button.slds-button',
      '[data-aura-class="forceSetupAssistant"] button.slds-button',
      // Cookie Consent
      '[class*="consent"] button:has-text("Accept")',
      '[class*="cookie"] button:has-text("Accept")',
      '[class*="cookie"] button:has-text("OK")',
      '[class*="cookie"] button:has-text("Agree")',
      // Session Extension
      'button:has-text("Continue")',
      'button:has-text("Extend Session")',
      // Guidance Center
      '.slds-popover[class*="guidance"] button[title="Close"]',
      'c-in-app-guidance button[title="Close"]',
      // Embedded Chat
      '[class*="embeddedService"] [title="Minimize"]',
      '[class*="snapins"] button[aria-label="Minimize"]',
      // Try New Lightning / Prompt
      '.slds-modal[class*="prompt"] button[title="Close"]',
      '.slds-modal[class*="prompt"] button:has-text("Not Now")',
      'section[role="dialog"] button:has-text("Not Now")'
    ];

    const dismissModals = () => {
      for (const selector of POPUP_SELECTORS) {
        const elements = document.querySelectorAll(selector);
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i] as HTMLElement;
          // Only click if it's visible
          if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            console.log(`[Chaos Handler] Auto-dismissing popup: ${selector}`);
            el.click();
          }
        }
      }
    };

    // Run once on load
    document.addEventListener('DOMContentLoaded', dismissModals);

    // Watch for dynamic popups
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldCheck = true;
          break;
        }
      }
      if (shouldCheck) {
        dismissModals();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  // Also keep the existing manual dismiss check for initial load
  page.on('load', async () => {
    try {
      await dismissBlockingModals(page);
    } catch {
      /* ignore */
    }
  });
}

export async function dismissBlockingModals(page: Page): Promise<void> {
  // Manual fallbacks in case the observer misses something or for cross-origin iframes
  try {
    const sessionContinue = page.getByRole('button', { name: /continue|extend session/i });
    if (await sessionContinue.first().isVisible({ timeout: 100 })) {
      await sessionContinue.first().click();
    }
  } catch {}
}
