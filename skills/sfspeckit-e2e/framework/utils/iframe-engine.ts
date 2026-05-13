import type { Page, Frame, Locator } from '@playwright/test';

/**
 * iframe-engine.ts — Automatic Cross-Iframe Traversal
 *
 * Salesforce heavily utilizes iframes for legacy Visualforce pages, Canvas apps,
 * and the entire Setup menu. Standard Playwright locators cannot pierce iframes
 * without knowing the exact frame selector in advance.
 *
 * This engine recursively evaluates a locator-building function across the main
 * page and ALL nested iframes, finding the first instance of a visible element,
 * eliminating the need for brittle `page.frameLocator('iframe[title="..."]')` chains.
 */
export class IframeEngine {
  /**
   * Executes a locator strategy across all frames to find a visible element.
   * 
   * @param page The main Playwright page.
   * @param locatorStrategy An async function that tries to find a locator in a given root.
   *                        Should return a Locator if found, or null/throw if not.
   * @returns The first visible Locator found, or falls back to the main page locator.
   */
  static async findVisibleLocator(
    page: Page,
    locatorStrategy: (root: Page | Frame) => Promise<Locator | null>
  ): Promise<Locator> {
    
    // 1. Try the main document first (Fastest path for standard LWC/Aura)
    try {
      const mainLocator = await locatorStrategy(page);
      if (mainLocator && await mainLocator.first().isVisible({ timeout: 250 }).catch(() => false)) {
        return mainLocator.first();
      }
    } catch {
      // Ignore and proceed to frames
    }

    // 2. Deep dive into all attached frames
    const frames = page.frames();
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue; // Already checked

      try {
        const frameLocator = await locatorStrategy(frame);
        if (frameLocator && await frameLocator.first().isVisible({ timeout: 250 }).catch(() => false)) {
          console.log(`[IframeEngine] Successfully pierced iframe to find element: ${frame.url()}`);
          return frameLocator.first();
        }
      } catch {
        // Continue searching other frames
      }
    }

    // 3. Fallback: Re-run on main page and return it to let Playwright handle timeouts/errors natively
    return (await locatorStrategy(page)) || page.locator('body'); // Failsafe return
  }
}
