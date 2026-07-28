import { test, expect } from "./fixtures"
import { bootAuto, auto } from "./helpers/harness"
import { navigate, switchHomeTab } from "./helpers/actions"
import { click, rightClickMenu } from "./helpers/mouse"

/**
 * Grand-tour spec: visit every route in src/router/routes.tsx and open every
 * major dialog/popup reachable from the UI. Layouts, router loaders and page
 * components only execute under real navigation, so this sweep exists to pull
 * their e2e coverage up; behavioral depth lives in the other specs.
 *
 * Deliberately skipped (not reachable deterministically from the seeded UI):
 *  - OAuth/OpenRouter success states (need a real provider round-trip; the
 *    invalid/error states of both callback pages are covered below);
 *  - "Get key from OpenRouter" in AI settings (opens an external window);
 *  - TaskDecomposeDialog / AI-assist flows (require a configured AI provider);
 *  - the checklist-guard dialog (already exercised by interaction.spec.ts);
 *  - GoalDetail/TaskDetail error boundaries (no in-app link can reach a bad
 *    id, and a hard goto would re-run the `?auto` harness mid-test);
 *  - Home's planning-pressure day click (Home doesn't wire onSelectDay).
 */

/**
 * Click that tolerates one liveQuery-driven re-render: right after a route
 * change the page's first frame (loader data) is swapped for the live frame,
 * which can detach the node between visibility check and mouse-down. Same
 * retry idea as helpers/mouse.ts rightClickMenu.
 */
async function retryClick(
  page: import("@playwright/test").Page,
  locator: import("@playwright/test").Locator
): Promise<void> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await click(page, locator)
      return
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

// A tab click can be swallowed while the page re-renders (dispatched but the
// selection never changes) — click until the tab actually reports selected.
async function selectTab(
  page: import("@playwright/test").Page,
  name: string
): Promise<void> {
  const tab = page.getByRole("tab", { name })
  for (let attempt = 0; attempt < 3; attempt++) {
    await retryClick(page, tab)
    try {
      await expect(tab).toHaveAttribute("data-state", "active", {
        timeout: 2_000,
      })
      return
    } catch {
      // re-click
    }
  }
  await expect(tab).toHaveAttribute("data-state", "active")
}

test("tours every main-app page and its major dialogs", async ({ page }) => {
  await bootAuto(page)
  const handles = await auto(page).handles()
  const fitnessGoalId = handles.goals["fitness"] as string
  const gearTaskId = handles.tasks["fitness.gear"] as string

  // ── Home ─────────────────────────────────────────────────────────────
  await expect(
    page.getByRole("heading", { name: "Today's Tasks" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Planning Pressure" })
  ).toBeVisible()

  // Walk the three "Today's Tasks" bucket tabs.
  await switchHomeTab(page, "inProgress")
  await switchHomeTab(page, "done")
  await switchHomeTab(page, "todo")

  // Planner dialog (header calendar-clock button; icon-only, so locate by
  // the lucide icon class).
  await click(page, page.locator('button:has([class*="lucide-calendar-clock"])'))
  await expect(page.getByRole("dialog")).toContainText("Day Planner")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // Sync settings via the header cloud button (opens Settings on the Sync
  // tab, whose panel is the SyncDialog's SyncSettings component).
  await click(page, page.locator('button:has([class*="lucide-cloud"])'))
  await expect(page.getByRole("tab", { name: "Sync" })).toHaveAttribute(
    "data-state",
    "active"
  )
  await expect(page.getByText("Provider", { exact: true }).first()).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // ── Settings dialog via the sidebar footer menu, all four tabs ───────
  // exact: true — the sidebar rows also carry "More actions" buttons.
  await click(page, page.getByRole("button", { name: "More", exact: true }))
  await click(page, page.getByRole("menuitem", { name: "Settings" }))
  await expect(page.getByText("Language", { exact: true }).first()).toBeVisible()
  await click(page, page.getByRole("tab", { name: "Planner" }))
  await expect(page.getByText("Daily scheduling capacity")).toBeVisible()
  await click(page, page.getByRole("tab", { name: "Sync" }))
  await expect(page.getByText("Provider", { exact: true }).first()).toBeVisible()
  await click(page, page.getByRole("tab", { name: "AI" }))
  await expect(page.getByText("AI Provider", { exact: true })).toBeVisible()
  await click(page, page.getByRole("tab", { name: "General" }))
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // About dialog via the same footer menu.
  await click(page, page.getByRole("button", { name: "More", exact: true }))
  await click(page, page.getByRole("menuitem", { name: "About" }))
  await expect(page.getByText("About TSAT")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)

  // ── Create-goal dialog ───────────────────────────────────────────────
  await click(page, page.locator('[data-testid="home-new-goal"]'))
  await expect(page.locator('[data-testid="create-goal-title"]')).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator('[data-testid="create-goal-title"]')).toHaveCount(0)

  // ── Create-task dialog: due-date calendar + repeat-rule panel ────────
  await click(page, page.locator('[data-testid="home-add-task"]'))
  const taskDialog = page.getByRole("dialog")
  await expect(taskDialog).toContainText("Create a Task")

  // Due-date calendar popover (the button shows the default due datetime, so
  // find it by its leading calendar icon).
  await click(
    page,
    taskDialog.locator('button:has([class*="lucide-calendar"])').first()
  )
  await expect(page.getByRole("grid")).toBeVisible()
  await page.keyboard.press("Escape") // closes the popover, keeps the dialog

  // Repeat needs a goal; pick one, then flip the repeat choice-card on.
  await click(page, page.locator('[data-testid="create-task-goal-select"]'))
  await click(page, page.getByRole("option", { name: "阅读习惯" }))
  await click(page, page.locator("#create-task-repeat-enabled"))
  await expect(page.getByText("Repeat Period (required)")).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(page.locator('[data-testid="create-task-title"]')).toHaveCount(0)

  // ── My Goals ─────────────────────────────────────────────────────────
  await navigate(page, "myGoals")
  const fitnessCard = page.locator(`[data-testid="goal-${fitnessGoalId}"]`)
  await expect(fitnessCard).toBeVisible()
  await selectTab(page, "Done")
  await expect(page.getByText("No goals done yet, keep going!")).toBeVisible()
  await selectTab(page, "In Progress")
  await expect(fitnessCard).toBeVisible()

  // ── Goal Detail via the goal card's right-click menu ─────────────────
  await rightClickMenu(page, fitnessCard, "ctx-goal-view")
  await expect(page.getByRole("heading", { name: "健身计划" })).toBeVisible()
  // Details tab first, then the Tasks tab with its list + dependency tree.
  await expect(page.getByRole("heading", { name: "Goal Progress" })).toBeVisible()
  await retryClick(page, page.getByRole("tab", { name: "Tasks", exact: true }))
  await expect(page.getByRole("heading", { name: "Tasks List" })).toBeVisible()

  // ── Tasks (My Tasks), all three tabs ─────────────────────────────────
  await navigate(page, "myTasks")
  const todayTab = page.locator('[data-testid="tasks-tab-today"]')
  await expect(todayTab).toHaveAttribute("data-state", "active")
  await retryClick(page, page.locator('[data-testid="tasks-tab-plans"]'))
  await expect(page.locator('[data-testid="tasks-tab-plans"]')).toHaveAttribute(
    "data-state",
    "active"
  )
  await click(page, page.locator('[data-testid="tasks-tab-unselected"]'))
  await expect(
    page.locator('[data-testid="tasks-tab-unselected"]')
  ).toHaveAttribute("data-state", "active")
  await click(page, todayTab)

  // ── Task Detail via a Home task row's right-click menu ───────────────
  await navigate(page, "home")
  const gearRow = page.locator(`[data-testid="task-${gearTaskId}"]`)
  await expect(gearRow).toBeVisible()
  await rightClickMenu(page, gearRow, "ctx-task-view")
  await expect(page.getByRole("heading", { name: "购买装备" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible()

  // ── All Tasks: search filter + row actions dropdown ──────────────────
  await navigate(page, "allTasks")
  const search = page.getByPlaceholder("Search tasks...")
  await expect(search).toBeVisible()
  // 11 seeded tasks paginate at 10 per page and row order isn't title-sorted,
  // so assert on the filtered result rather than a specific unfiltered row.
  await expect(page.getByText("Rows per page")).toBeVisible()
  await search.fill("购买")
  const gearTableRow = page.getByRole("row").filter({ hasText: "购买装备" })
  await expect(gearTableRow).toBeVisible()
  await expect(page.getByRole("row").filter({ hasText: "每日阅读" })).toHaveCount(
    0
  )
  // Last button in the row is the actions dropdown (the goal cell's select
  // trigger renders as a combobox before it).
  await click(page, gearTableRow.locator("button").last())
  await click(page, page.getByRole("menuitem", { name: "View Details" }))
  await expect(page.getByRole("heading", { name: "购买装备" })).toBeVisible()
})

test("tours all documentation pages", async ({ page }) => {
  // The doc branch needs no seed; /doc redirects to concepts/core.
  await page.goto("/doc")
  await expect(
    page.getByRole("heading", { level: 1, name: "Core Concepts" })
  ).toBeVisible()

  // "On this page" rail: jump to the first section of the current page.
  const onThisPage = page.locator("aside").filter({ hasText: "On this page" })
  await click(page, onThisPage.locator("ul button").first())

  // Every remaining doc page through the docs sidebar (client-side nav).
  // "Trigger" and "RepeatRule vs Trigger" land on the same page via different
  // hash anchors, exercising the hash-scroll path too.
  const docsNav = page.locator("aside").first()
  const docPages: Array<[nav: string, heading: string]> = [
    ["Estimated Occurrences", "Estimated Occurrences"],
    ["Trigger", "Repeated tasks"],
    ["RepeatRule vs Trigger", "Repeated tasks"],
    ["Daily Focus", "Daily Focus"],
    ["Quick Start", "Quick Start"],
    ["Set a Trigger", "Set a Trigger"],
    ["Set a RepeatRule", "Repeat Rule Setup"],
    ["Sync Setup", "Sync Setup"],
    ["AI Setup", "AI Setup"],
  ]
  for (const [nav, heading] of docPages) {
    await click(page, docsNav.getByRole("button", { name: nav, exact: true }))
    await expect(
      page.getByRole("heading", { level: 1, name: heading })
    ).toBeVisible()
  }

  // Header "Home" button returns to the app shell (fresh, unseeded boot).
  await click(page, page.getByRole("button", { name: "Home", exact: true }))
  await expect(
    page.getByRole("heading", { name: "Today's Tasks" })
  ).toBeVisible()
})

test("renders the sync OAuth callback page (invalid-result state)", async ({
  page,
}) => {
  // No result payload in the hash → the page's invalid state.
  await page.goto("/auth/callback")
  await expect(page.getByText("Invalid authorization result")).toBeVisible()
  await click(page, page.getByRole("button", { name: "Return to app" }))
  await expect(
    page.getByRole("heading", { name: "Today's Tasks" })
  ).toBeVisible()
})

test("renders the OpenRouter callback page (error state)", async ({ page }) => {
  // No code and no stored verifier → the page's error state.
  await page.goto("/auth/openrouter")
  await expect(
    page.getByText("OpenRouter authorization failed")
  ).toBeVisible()
  await click(page, page.getByRole("button", { name: "Return to app" }))
  await expect(
    page.getByRole("heading", { name: "Today's Tasks" })
  ).toBeVisible()
})
