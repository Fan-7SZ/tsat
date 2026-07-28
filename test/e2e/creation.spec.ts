import { test, expect } from "./fixtures"
import { bootAuto, auto } from "./helpers/harness"
import {
  createGoalViaUI,
  createTaskViaUI,
  navigate,
  focusGoal,
  unfocusGoal,
  taskAction,
} from "./helpers/actions"
import { click } from "./helpers/mouse"

/**
 * UI creation + focus coverage. Unlike the seeded simulations, these drive the
 * actual create dialogs and focus toggles with mouse clicks (text fields typed
 * on the keyboard), so "user adds a goal / task", "user focuses a goal", and
 * "user adds a task to today" are all exercised end to end.
 */

test("create a goal and a task through the UI", async ({ page }) => {
  await bootAuto(page)

  await createGoalViaUI(page, "冥想练习")
  await expect
    .poll(async () =>
      (await auto(page).snapshot()).goals.some((g) => g.title === "冥想练习")
    )
    .toBe(true)

  await createTaskViaUI(page, "冥想练习", "每日冥想 10 分钟")
  const snap = await auto(page).snapshot()
  const goal = snap.goals.find((g) => g.title === "冥想练习")!
  const task = snap.tasks.find((t) => t.title === "每日冥想 10 分钟")
  expect(task, "task was created").toBeTruthy()
  expect(task!.goalId, "task bound to the new goal").toBe(goal.id)
})

test("focus then unfocus a goal via the right-click menu", async ({ page }) => {
  await bootAuto(page)

  // A freshly created goal with no tasks isn't auto-focused, so the focus toggle
  // is meaningful here.
  await createGoalViaUI(page, "写作计划")
  const goalId = (await auto(page).snapshot()).goals.find(
    (g) => g.title === "写作计划"
  )!.id

  await navigate(page, "myGoals")
  await focusGoal(page, goalId)
  await expect
    .poll(async () => {
      const raw = await page.evaluate(async () => {
        const req = indexedDB.open("track-db")
        const db: IDBDatabase = await new Promise((res) => {
          req.onsuccess = () => res(req.result)
        })
        return new Promise<number>((res) => {
          const r = db
            .transaction("manualFocuses")
            .objectStore("manualFocuses")
            .getAll()
          r.onsuccess = () =>
            res(
              (r.result as { goalId: string }[]).filter((x) => x.goalId).length
            )
        })
      })
      return raw
    })
    .toBeGreaterThan(0)

  await unfocusGoal(page, goalId)
})

test("add a task to today from its detail page (addTaskRun)", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const cardId = h.tasks["fitness.card"] // depends on gear → no run today

  expect(
    (await auto(page).snapshot()).dayRuns.some((r) => r.taskId === cardId),
    "card has no run initially"
  ).toBe(false)

  // Reach the task's detail page via the All Tasks list (real link click).
  await navigate(page, "allTasks")
  await click(page, page.getByRole("link", { name: "办理健身卡" }).first())
  await expect(page).toHaveURL(new RegExp(`/tasks/${cardId}$`))

  // The primary completion control offers "Add to Today" for a task with no run.
  await click(page, page.locator('[data-testid="task-primary-addToday"]'))

  await expect
    .poll(async () =>
      (await auto(page).snapshot()).dayRuns.some((r) => r.taskId === cardId)
    )
    .toBe(true)
})

test("exclude a task run from today (removeTaskRuntime)", async ({ page }) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const gearId = h.tasks["fitness.gear"]

  // Exclude ("remove from today") the frontier gear run via the context menu.
  await taskAction(page, gearId, "exclude")
  await expect
    .poll(async () =>
      (await auto(page).snapshot()).dayRuns.some((r) => r.taskId === gearId)
    )
    .toBe(false)
})
