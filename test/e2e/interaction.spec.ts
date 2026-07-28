import { test, expect } from "./fixtures"
import { bootAuto, auto } from "./helpers/harness"
import { taskAction, expectTaskVisible } from "./helpers/actions"

/**
 * Phase-2 validation: the pure-mouse interaction layer drives real user flows.
 * Seeded goals plan their frontier runs immediately (no manual focus needed), so
 * Home lists them from the start. We exercise the right-click context menu to
 * complete a task and confirm the completedCount == task-done activity invariant.
 */
test("complete a frontier task via the right-click menu", async ({ page }) => {
  await bootAuto(page)
  const handles = await auto(page).handles()
  const gearTaskId = handles.tasks["fitness.gear"]
  // First non-repeat run: runtimeId === taskId.
  const gearRuntimeId = gearTaskId

  // Home lists the frontier task from the start.
  await expectTaskVisible(page, gearRuntimeId)

  // Mark it done via the right-click menu (todo → done).
  await taskAction(page, gearRuntimeId, "done")

  // Invariant: completedCount == number of task-done activities for this task.
  await expect
    .poll(async () => {
      const snap = await auto(page).snapshot()
      const task = snap.tasks.find((t) => t.id === gearTaskId)
      const doneActivities = snap.activities.filter(
        (a) => a.taskId === gearTaskId && a.kind === "task-done"
      )
      return {
        completedCount: task?.completedCount,
        doneActivities: doneActivities.length,
      }
    })
    .toEqual({ completedCount: 1, doneActivities: 1 })
})

test("complete a repeat-debt run marks its ledger point completed", async ({
  page,
}) => {
  await bootAuto(page)
  const handles = await auto(page).handles()
  const dailyTaskId = handles.tasks["reading.daily"]

  // A repeat debt run for the earliest overdue point (2025-12-27).
  const debtRuntimeId = `${dailyTaskId}::2025-12-27`
  await expectTaskVisible(page, debtRuntimeId)
  await taskAction(page, debtRuntimeId, "done")

  await expect
    .poll(async () => {
      const snap = await auto(page).snapshot()
      const ledger = snap.ledgers.find((l) => l.taskId === dailyTaskId)
      return ledger?.points["2025-12-27"]
    })
    .toBe("completed")
})
