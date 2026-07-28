import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"
import { click, rightClickMenu } from "./mouse"

/**
 * High-level, id-addressed user actions built on the pure-mouse primitives.
 * Navigation uses real link clicks (SPA routing) so the `?auto` harness never
 * re-runs (a full page reload would wipe + reseed).
 */

const NAV = {
  home: "Home",
  myGoals: "My Goals",
  myTasks: "My Tasks",
  allTasks: "All Tasks",
} as const

/** Click a sidebar nav link by its visible label (client-side route change). */
export async function navigate(
  page: Page,
  to: keyof typeof NAV
): Promise<void> {
  const link = page.getByRole("link", { name: NAV[to], exact: true }).first()
  await click(page, link)
  // Let the route's first render settle.
  await page.waitForLoadState("domcontentloaded")
}

/** Switch the Home "Today's Tasks" bucket tab (todo | inProgress | done). */
export async function switchHomeTab(
  page: Page,
  tab: "todo" | "inProgress" | "done"
): Promise<void> {
  await click(page, page.locator(`[data-testid="home-tab-${tab}"]`))
  await page.waitForTimeout(80)
}

function goalCard(page: Page, goalId: string) {
  return page.locator(`[data-testid="goal-${goalId}"]`)
}

function taskRow(page: Page, runtimeId: string) {
  return page.locator(`[data-testid="task-${runtimeId}"]`)
}

/** Right-click a goal card → Focus Today. (Must be on a page showing the goal.) */
export async function focusGoal(page: Page, goalId: string): Promise<void> {
  await rightClickMenu(page, goalCard(page, goalId), "ctx-goal-focus")
}

/** Right-click a goal card → Unfocus. */
export async function unfocusGoal(page: Page, goalId: string): Promise<void> {
  await rightClickMenu(page, goalCard(page, goalId), "ctx-goal-unfocus")
}

/** Right-click a goal card → Delete → confirm. */
export async function deleteGoal(page: Page, goalId: string): Promise<void> {
  await rightClickMenu(page, goalCard(page, goalId), "ctx-goal-delete")
  // Confirm dialog: click the destructive confirm button.
  const confirm = page.getByRole("button", { name: /delete|删除/i }).last()
  await click(page, confirm)
}

/** Focus an input (mouse click) and type into it via the keyboard. */
async function typeInto(
  page: Page,
  testId: string,
  text: string
): Promise<void> {
  const input = page.locator(`[data-testid="${testId}"]`)
  await click(page, input)
  await input.fill(text) // reliably sets + fires the input event RHF listens to
}

/**
 * Create a goal through the real UI: New Goal button → type the name → Create.
 * Text entry uses the keyboard; every button/target is a real mouse click.
 */
export async function createGoalViaUI(
  page: Page,
  title: string
): Promise<void> {
  await click(page, page.locator('[data-testid="home-new-goal"]'))
  await typeInto(page, "create-goal-title", title)
  const submit = page.locator('[data-testid="create-goal-submit"]')
  await expect(submit).toBeEnabled({ timeout: 5000 }) // wait for form validation
  await click(page, submit)
  await expect(page.locator('[data-testid="create-goal-title"]')).toHaveCount(
    0,
    { timeout: 5000 }
  )
}

/** Create a task under `goalTitle` through the real UI. */
export async function createTaskViaUI(
  page: Page,
  goalTitle: string,
  taskTitle: string
): Promise<void> {
  await click(page, page.locator('[data-testid="home-add-task"]'))
  await typeInto(page, "create-task-title", taskTitle)
  // Pick the goal from the Radix select (open → click the matching option).
  await click(page, page.locator('[data-testid="create-task-goal-select"]'))
  await click(page, page.getByRole("option", { name: goalTitle }).first())
  const submit = page.locator('[data-testid="create-task-submit"]')
  await expect(submit).toBeEnabled({ timeout: 5000 })
  await click(page, submit)
  await expect(page.locator('[data-testid="create-task-title"]')).toHaveCount(
    0,
    { timeout: 5000 }
  )
}

/**
 * Open a collapsed row's runs dialog (via its "Nx runs" badge) and set one
 * run's status through the per-run status select — how a user acts on an
 * individual run when several of a task collapse into one row. Returns the
 * count shown on the collapsed badge (e.g. "3" from "3x") for verification.
 */
export async function setRunStatusViaRunsDialog(
  page: Page,
  taskId: string,
  runtimeId: string,
  status: "todo" | "inProgress" | "done"
): Promise<string> {
  const badge = page.locator(`[data-testid="runs-badge-${taskId}"]`)
  const badgeText = (await badge.innerText()).trim()
  await click(page, badge)
  const trigger = page.locator(`[data-testid="run-status-${runtimeId}"]`)
  await expect(trigger).toBeVisible({ timeout: 5000 })
  await click(page, trigger)
  await click(page, page.locator(`[data-testid="run-status-opt-${status}"]`))
  await page.keyboard.press("Escape") // close the dialog
  return badgeText
}

export type TaskCtxAction =
  | "add"
  | "inprogress"
  | "done"
  | "back-todo"
  | "back-inprogress"
  | "again"
  | "skip"
  | "exclude"
  | "restore"
  | "add-future"

/** Right-click a task row → pick a runtime action from the context menu. */
export async function taskAction(
  page: Page,
  runtimeId: string,
  action: TaskCtxAction
): Promise<void> {
  await rightClickMenu(page, taskRow(page, runtimeId), `ctx-task-${action}`)
  // Completing a task that has steps opens a checklist guard: check every step,
  // then confirm. (Marking done on a stepless task closes immediately.)
  if (action === "done") {
    const confirm = page.locator('[data-testid="checklist-confirm"]')
    if (await confirm.isVisible().catch(() => false)) {
      const boxes = page.getByRole("dialog").getByRole("checkbox")
      const n = await boxes.count()
      for (let i = 0; i < n; i++) await click(page, boxes.nth(i))
      await expect(confirm).toBeEnabled({ timeout: 3000 })
      await click(page, confirm)
      await expect(confirm).toBeHidden({ timeout: 3000 })
    }
  }
}

/** Assert a task row is present / absent in the current view. */
export async function expectTaskVisible(page: Page, runtimeId: string) {
  await expect(taskRow(page, runtimeId)).toBeVisible()
}
export async function expectTaskAbsent(page: Page, runtimeId: string) {
  await expect(taskRow(page, runtimeId)).toHaveCount(0)
}
