import type { Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"

/**
 * Pure hardware-level mouse operations. Everything routes through
 * `page.mouse.*` at real coordinates (never locator.click / DOM dispatch), so
 * the app receives genuine pointer/contextmenu events exactly as a user would
 * generate them.
 */

interface Point {
  x: number
  y: number
}

async function centerOf(locator: Locator): Promise<Point> {
  await locator.waitFor({ state: "visible", timeout: 8000 })
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  if (!box) throw new Error("target has no bounding box (not visible)")
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Move the pointer smoothly to the element center. */
export async function moveTo(page: Page, locator: Locator): Promise<Point> {
  const p = await centerOf(locator)
  await page.mouse.move(p.x, p.y, { steps: 8 })
  return p
}

/** Left-click at the element center with a real move-then-click. */
export async function click(page: Page, locator: Locator): Promise<void> {
  const p = await moveTo(page, locator)
  await page.mouse.down()
  await page.mouse.up()
  void p
}

/** Right-click (contextmenu) at the element center. */
export async function rightClick(page: Page, locator: Locator): Promise<void> {
  const p = await moveTo(page, locator)
  await page.mouse.click(p.x, p.y, { button: "right" })
}

/** Double-click at the element center. */
export async function doubleClick(page: Page, locator: Locator): Promise<void> {
  const p = await moveTo(page, locator)
  await page.mouse.dblclick(p.x, p.y)
}

/**
 * Right-click a trigger, then left-click a menu item (both pure mouse). Waits
 * for the Radix menu item to render before clicking, and for it to detach after.
 */
export async function rightClickMenu(
  page: Page,
  trigger: Locator,
  menuItemTestId: string
): Promise<void> {
  const item = page.locator(`[data-testid="${menuItemTestId}"]`)
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Clear any stale open menu so a leftover overlay can't eat the click.
      await page.keyboard.press("Escape").catch(() => {})
      await rightClick(page, trigger)
      await expect(item).toBeVisible({ timeout: 3000 })
      await click(page, item)
      await expect(item).toBeHidden({ timeout: 3000 })
      return
    } catch (e) {
      lastErr = e
      await page.keyboard.press("Escape").catch(() => {})
    }
  }
  throw lastErr
}
