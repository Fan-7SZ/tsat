import { test, expect } from "./fixtures"
import {
  bootAuto,
  advanceToDay,
  addDays,
  auto,
  SIM_START,
} from "./helpers/harness"
import { navigate, taskAction } from "./helpers/actions"
import { click, rightClick } from "./helpers/mouse"

/**
 * "Removed from today" (dismiss) semantics.
 *
 * A trigger is just "a normal task + a condition", so a dismissed trigger task
 * belongs in Unscheduled exactly like a plain one — badged, and still listed
 * under Plans > By Trigger (which only says when it fires next, and offers no
 * way to pull it back). Due-forced runs are the exception: they cannot be
 * dismissed at all, so the menu item is disabled with a reason hovercard.
 */

const unselectedTab = '[data-testid="tasks-tab-unselected"]'

async function openUnscheduled(page: import("@playwright/test").Page) {
  await navigate(page, "myTasks")
  await click(page, page.locator(unselectedTab))
  await page.waitForTimeout(150)
}

test("a dismissed plain task lands in Unscheduled with the badge", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const gearId = h.tasks["fitness.gear"] // plain task, run id == task id

  await taskAction(page, gearId, "exclude")
  await expect
    .poll(async () =>
      (await auto(page).snapshot()).dayRuns.some((r) => r.taskId === gearId)
    )
    .toBe(false)

  await openUnscheduled(page)
  const row = page.locator(`[data-testid="task-${gearId}"]`)
  await expect(row, "dismissed task is listed under Unscheduled").toBeVisible()
  await expect(
    row.locator('[data-testid="badge-dismissed"]'),
    "carries the excluded-from-today badge"
  ).toBeVisible()
})

test("a dismissed trigger-goal task lands in Unscheduled and stays under By Trigger", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  // A task with its OWN trigger fires as `triggerPolicy` — not due-forced, so it
  // is dismissible (unlike a run pulled in by due policy).
  const reviewId = h.tasks["study.review"]

  const run = (await auto(page).snapshot()).dayRuns.find(
    (r) => r.taskId === reviewId
  )!
  expect(run.source, "fired by its own trigger").toBe("triggerPolicy")
  await taskAction(page, run.id, "exclude")

  // The dismissal is recorded, so it shows in Unscheduled with the badge…
  await openUnscheduled(page)
  const row = page.locator(`[data-testid="task-${reviewId}"]`)
  await expect(row, "dismissed trigger task is in Unscheduled").toBeVisible()
  await expect(row.locator('[data-testid="badge-dismissed"]')).toBeVisible()

  // …and it is still listed under Plans > By Trigger (next fire date), which is
  // informational only — Unscheduled is the actionable place to pull it back.
  await click(page, page.locator('[data-testid="tasks-tab-plans"]'))
  await page.waitForTimeout(150)
  await expect(
    page.getByText("复习", { exact: true }).first(),
    "still shown under By Trigger"
  ).toBeVisible()
})

test("the badge is day-scoped: it clears after the day boundary", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const gearId = h.tasks["fitness.gear"]

  await taskAction(page, gearId, "exclude")
  await openUnscheduled(page)
  await expect(
    page.locator(
      `[data-testid="task-${gearId}"] [data-testid="badge-dismissed"]`
    )
  ).toBeVisible()

  await advanceToDay(page, addDays(SIM_START, 1))
  await expect
    .poll(async () =>
      page
        .locator('[data-testid="badge-dismissed"]')
        .count()
        .then((n) => n === 0)
    )
    .toBe(true)
})

test("a due-forced run cannot be dismissed — the item is disabled", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const classId = h.tasks["study.class"]

  // Walk to a day where the study goal's due window has pulled a task in via
  // goal-due policy (a run whose source is goalDuePolicy).
  let cur = SIM_START
  let forcedRunId: string | undefined
  for (let i = 0; i < 40 && !forcedRunId; i++) {
    const snap = await auto(page).snapshot()
    forcedRunId = snap.dayRuns.find(
      (r) => r.source === "goalDuePolicy" || r.source === "duePolicy"
    )?.id
    if (forcedRunId) break
    cur = addDays(cur, 1)
    await advanceToDay(page, cur)
  }
  expect(forcedRunId, "a due-forced run appeared").toBeTruthy()
  void classId

  // Right-click it: "Exclude from today" must be the DISABLED variant.
  await rightClick(page, page.locator(`[data-testid="task-${forcedRunId}"]`))
  await expect(
    page.locator('[data-testid="ctx-task-exclude-disabled"]'),
    "due-forced runs offer only the disabled exclude"
  ).toBeVisible()
  await expect(page.locator('[data-testid="ctx-task-exclude"]')).toHaveCount(0)
})

test("a goal whose tasks are all dismissed cannot be focused", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const goalId = h.goals["nodue"] // single-task goal, fires on Wednesdays
  const choreId = h.tasks["nodue.chore"]

  // Advance to the fire day so its only task is planned.
  for (let d = 1; d <= 6; d++) await advanceToDay(page, addDays(SIM_START, d))
  const run = (await auto(page).snapshot()).dayRuns.find(
    (r) => r.taskId === choreId
  )
  expect(run, "the goal's task is planned on the fire day").toBeTruthy()

  // While it has something to plan, the focus toggle is live.
  await expect(
    page.locator(`[data-testid="focus-toggle-${goalId}"]`),
    "toggle is enabled while the goal has plannable work"
  ).toBeVisible()

  // Remove its only task from today → focusing could surface nothing.
  await taskAction(page, run!.id, "exclude")

  await expect(
    page.locator(`[data-testid="focus-toggle-disabled-${goalId}"]`),
    "toggle is disabled once every task is removed from today"
  ).toBeVisible()
  await expect(
    page.locator(`[data-testid="focus-toggle-disabled-${goalId}"]`)
  ).toBeDisabled()
})
