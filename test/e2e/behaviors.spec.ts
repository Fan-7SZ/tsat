import { test, expect } from "./fixtures"
import {
  bootAuto,
  advanceToDay,
  addDays,
  auto,
  SIM_START,
} from "./helpers/harness"
import {
  taskAction,
  switchHomeTab,
  setRunStatusViaRunsDialog,
  unfocusGoal,
} from "./helpers/actions"
import { doubleClick } from "./helpers/mouse"

/**
 * Discrete behavior coverage — one clean assertion per user operation the
 * two-month loop doesn't exercise directly (counter run-again, cross-day
 * carry-over, repeat skip, double-click navigation). Together with smoke +
 * interaction + the two simulations, every runtime action is covered.
 */

// A counter task progresses via same-day "run again" (addTaskRun): each run is a
// distinct runtime, so completedCount and task-done activities advance together.
test("counter task: run again three times keeps completedCount == activities", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const counterId = h.tasks["fitness.sessions"] // total 3

  for (let i = 1; i <= 3; i++) {
    // Complete the current todo run.
    const snap = await auto(page).snapshot()
    const todo = snap.dayRuns.find(
      (r) => r.taskId === counterId && r.arrangementStatus === "todo"
    )
    if (!todo) throw new Error(`no todo run for counter at iteration ${i}`)
    await taskAction(page, todo.id, "done")

    await expect
      .poll(async () => {
        const s = await auto(page).snapshot()
        const t = s.tasks.find((x) => x.id === counterId)!
        const acts = s.activities.filter(
          (a) => a.taskId === counterId && a.kind === "task-done"
        ).length
        return { completedCount: t.completedCount, acts }
      })
      .toEqual({ completedCount: i, acts: i })

    // If occurrences remain, spawn the next run via "run again" on the run we
    // just finished (Done tab), then return to Todo for the next completion.
    if (i < 3) {
      await switchHomeTab(page, "done")
      await taskAction(page, todo.id, "again")
      await switchHomeTab(page, "todo")
      // Wait for the freshly spawned todo run to materialize.
      await expect
        .poll(async () => {
          const s = await auto(page).snapshot()
          return s.dayRuns.filter(
            (r) => r.taskId === counterId && r.arrangementStatus === "todo"
          ).length
        })
        .toBeGreaterThan(0)
    }
  }
})

// An allowCrossDay task left in progress survives the day sweep (same runtime,
// dateKey rewritten to the new today).
test("allowCrossDay task carries an in-progress run across midnight", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const notesId = h.tasks["reading.notes"] // allowCrossDay: true
  const notesRuntimeId = notesId // first non-repeat run

  await taskAction(page, notesRuntimeId, "inprogress")

  await advanceToDay(page, addDays(SIM_START, 1))

  const snap = await auto(page).snapshot()
  const carried = snap.dayRuns.find((r) => r.id === notesRuntimeId)
  expect(carried, "notes run survived the sweep").toBeTruthy()
  expect(carried!.arrangementStatus).toBe("inProgress")
  expect(carried!.dateKey).toBe("2026-01-02")

  // …but ONLY while in progress. Once it is completed, the next sweep must drop
  // it — allowCrossDay preserves unfinished work, it must never make a finished
  // run linger forever.
  await switchHomeTab(page, "inProgress")
  await taskAction(page, notesRuntimeId, "done")
  await switchHomeTab(page, "todo")

  await advanceToDay(page, addDays(SIM_START, 2))
  await expect
    .poll(async () =>
      (await auto(page).snapshot()).dayRuns.some((r) => r.id === notesRuntimeId)
    )
    .toBe(false)

  // And it stays gone on later days (no resurrection by replan).
  await advanceToDay(page, addDays(SIM_START, 3))
  const later = await auto(page).snapshot()
  expect(
    later.dayRuns.filter((r) => r.taskId === notesId),
    "no lingering run for the completed allowCrossDay task"
  ).toHaveLength(0)
})

// Skipping a repeat run marks its ledger point "skipped".
test("skip a repeat debt run marks its ledger point skipped", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const dailyId = h.tasks["reading.daily"]
  const debtRuntimeId = `${dailyId}::2025-12-28`

  await taskAction(page, debtRuntimeId, "skip")

  await expect
    .poll(async () => {
      const s = await auto(page).snapshot()
      return s.ledgers.find((l) => l.taskId === dailyId)?.points["2025-12-28"]
    })
    .toBe("skipped")
})

// Regression: a counter completed ONCE PER DAY across several
// days counts every completion (each day's run is a distinct runtime id, so its
// task-done activity is distinct — completedCount stays == the activity count).
test("counter completed once per day across days counts each completion", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const counterId = h.tasks["fitness.sessions"] // total 3

  const seenRuntimeIds = new Set<string>()
  for (let day = 0; day < 3; day++) {
    const snap = await auto(page).snapshot()
    const todo = snap.dayRuns.find(
      (r) => r.taskId === counterId && r.arrangementStatus === "todo"
    )
    expect(todo, `counter has a run to do on day ${day}`).toBeTruthy()
    // Each day's run is a DISTINCT runtime id.
    expect(seenRuntimeIds.has(todo!.id), `distinct run id on day ${day}`).toBe(
      false
    )
    seenRuntimeIds.add(todo!.id)

    await taskAction(page, todo!.id, "done")

    await expect
      .poll(async () => {
        const s = await auto(page).snapshot()
        const t = s.tasks.find((x) => x.id === counterId)!
        const acts = s.activities.filter(
          (a) => a.taskId === counterId && a.kind === "task-done"
        ).length
        return { completedCount: t.completedCount, acts }
      })
      .toEqual({ completedCount: day + 1, acts: day + 1 })

    if (day < 2) await advanceToDay(page, addDays(SIM_START, day + 1))
  }
})

// Regression for the residual hole a completedCount-derived run id had: keying
// the run number by the count meant that out-of-order run-again + undo across a
// day boundary could reuse a number whose activity still existed, over-counting
// completedCount. Date-scoped runtime ids make every execution intrinsically
// unique (the date never repeats), so it holds under exactly that sequence.
test("counter stays consistent under out-of-order run-again, undo, and cross-day", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const counterId = h.tasks["fitness.chores"] // total 5

  const check = async (label: string) => {
    const s = await auto(page).snapshot()
    const t = s.tasks.find((x) => x.id === counterId)!
    const acts = s.activities.filter(
      (a) => a.taskId === counterId && a.kind === "task-done"
    ).length
    expect(t.completedCount, `${label}: completedCount == activities`).toBe(
      acts
    )
    return { snap: s, completedCount: t.completedCount }
  }
  const primaryTodo = async () =>
    (await auto(page).snapshot()).dayRuns.find(
      (r) => r.taskId === counterId && r.arrangementStatus === "todo"
    )!

  // Day 0: one completion.
  await taskAction(page, (await primaryTodo()).id, "done")
  await check("day0")

  // Day 1: complete the primary, then run-again and complete that too.
  await advanceToDay(page, addDays(SIM_START, 1))
  const p = await primaryTodo()
  await taskAction(page, p.id, "done")
  await switchHomeTab(page, "done")
  await taskAction(page, p.id, "again")
  await switchHomeTab(page, "todo")
  await taskAction(page, (await primaryTodo()).id, "done")
  await check("day1 two done")

  // Now two chores runs are done → they collapse into one row on the Done tab.
  // The collapsed badge shows the run count, and the runs dialog exposes each.
  await switchHomeTab(page, "done")
  const day1Done = (await auto(page).snapshot()).dayRuns
    .filter((r) => r.taskId === counterId && r.arrangementStatus === "done")
    .map((r) => r.id)
  expect(day1Done.length, "both day-1 runs are done").toBe(2)

  // Undo the FIRST of them via the collapsed row's runs dialog — leaving a
  // NON-contiguous completion set (the exact trigger of the old bug).
  const badgeText = await setRunStatusViaRunsDialog(
    page,
    counterId,
    day1Done[0],
    "todo"
  )
  expect(badgeText, "collapsed badge reflects the 2 runs").toContain("2")
  await switchHomeTab(page, "todo")
  await check("day1 after undo (non-contiguous)")

  // Cross to day 2 and complete the fresh primary run — its date-scoped id can
  // never collide with the still-done day-1 run's activity.
  await advanceToDay(page, addDays(SIM_START, 2))
  await taskAction(page, (await primaryTodo()).id, "done")
  await check("day2 — no id collision, no drift")
})

// Regression: a repeat task under a goal with a due date is
// NOT due-forced — near the due, only its scheduled occurrences surface, never a
// plain due-policy run (which would bump completedCount off its ledger).
test("repeat task under a goal-due is never due-forced", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const classId = h.tasks["study.class"] // weekly Mon/Wed/Fri, goal due 2026-01-31

  // Advance to 2026-01-29 (Thursday — inside the goal-due window, NOT a class
  // day). No actions, so the ledger stays planned and completedCount stays 0.
  let cur = SIM_START
  while ((await auto(page).currentDateKey()) < "2026-01-29") {
    cur = addDays(cur, 1)
    await advanceToDay(page, cur)
  }

  const snap = await auto(page).snapshot()
  const classRuns = snap.dayRuns.filter((r) => r.taskId === classId)
  // The repeat task's only runs are its own occurrences (repeatPolicy debt for
  // past unfinished points). It must NEVER be pulled in by due/goal-due policy.
  const dueForcedRuns = classRuns.filter((r) => r.source !== "repeatPolicy")
  expect(
    dueForcedRuns,
    `repeat task must not be due-forced; got ${dueForcedRuns.map((r) => r.source).join(",")}`
  ).toHaveLength(0)

  // And completedCount never drifted from the ledger.
  const task = snap.tasks.find((t) => t.id === classId)!
  const ledgerCompleted = Object.values(
    snap.ledgers.find((l) => l.taskId === classId)?.points ?? {}
  ).filter((v) => v === "completed").length
  expect(task.completedCount).toBe(ledgerCompleted)
})

// A goal trigger pulls its goal up by FOCUSING it for the day — it must not
// depend on the due a reset optionally stamps (`setDueOnReset`). Before this was
// fixed, a trigger configured with `setDueOnReset: false` fired every week and
// never surfaced anything, because the only goal-level forced-focus reason was
// the due-policy one.
test("a goal trigger with no due still pulls its tasks up on the fire day", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const choreId = h.tasks["nodue.chore"]
  const goalId = h.goals["nodue"]

  const runsFor = async () =>
    (await auto(page).snapshot()).dayRuns.filter((r) => r.taskId === choreId)

  // Day 0 (Thu) is not a fire day.
  expect(await runsFor(), "no run before the trigger fires").toHaveLength(0)

  // Day 6 is the first Wednesday — the trigger fires and must surface the task.
  for (let d = 1; d <= 6; d++) await advanceToDay(page, addDays(SIM_START, d))
  const snap = await auto(page).snapshot()
  const fired = snap.goalTriggerStates.find((s) => s.goalId === goalId)
  expect(fired?.lastTriggeredDateKey, "trigger fired").toBe("2026-01-07")
  expect(
    snap.goals.find((g) => g.id === goalId)?.dueAt,
    "setDueOnReset:false stamps no due"
  ).toBeFalsy()
  expect(
    snap.dayRuns.filter((r) => r.taskId === choreId),
    "task is pulled up purely by the trigger's focus"
  ).toHaveLength(1)

  // Off-days do not keep it focused.
  await advanceToDay(page, addDays(SIM_START, 7))
  expect(await runsFor(), "not focused on a non-fire day").toHaveLength(0)
})

// Firing pulls the goal up ONCE, at the day boundary — it is not a lock that
// holds all day. Previously the pull-up was re-derived on every replan from
// `lastTriggeredDateKey === today`, so un-focusing the goal was immediately
// undone by the replan that un-focusing itself triggers.
test("un-focusing a fired trigger goal sticks for the rest of the day", async ({
  page,
}) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const choreId = h.tasks["nodue.chore"]
  const goalId = h.goals["nodue"]

  const runsFor = async () =>
    (await auto(page).snapshot()).dayRuns.filter((r) => r.taskId === choreId)

  // Day 6 is the fire day: the goal is pulled up and its task surfaces.
  for (let d = 1; d <= 6; d++) await advanceToDay(page, addDays(SIM_START, d))
  expect(await runsFor(), "pulled up on the fire day").toHaveLength(1)

  // The pull-up is a recorded focus row, tagged as trigger-placed so the UI can
  // word the reason differently from a focus the user placed by hand.
  const focusRow = (await auto(page).snapshot()).manualFocuses.find(
    (f) => f.goalId === goalId
  )
  expect(focusRow?.source, "focus row is tagged as trigger-placed").toBe(
    "trigger"
  )
  expect(focusRow?.dateKey, "and is scoped to the fire day").toBe("2026-01-07")

  // The user un-focuses it — on the fire day itself.
  await unfocusGoal(page, goalId)
  expect(
    (await auto(page).snapshot()).manualFocuses.find(
      (f) => f.goalId === goalId
    ),
    "the focus row is gone"
  ).toBeUndefined()
  expect(
    await runsFor(),
    "un-focus is not bounced back by the replan it triggers"
  ).toHaveLength(0)

  // And it stays gone: any later replan must not re-derive the pull-up.
  await page.evaluate(() =>
    (window as unknown as { __auto: { replan(s?: string): Promise<void> } })
      .__auto.replan("full")
  )
  expect(await runsFor(), "still gone after another replan").toHaveLength(0)
})

// A double-click on a task row navigates to its detail page (real dblclick).
test("double-click a task row opens its detail page", async ({ page }) => {
  await bootAuto(page)
  const h = await auto(page).handles()
  const gearId = h.tasks["fitness.gear"]

  await doubleClick(page, page.locator(`[data-testid="task-${gearId}"]`))
  await expect(page).toHaveURL(new RegExp(`/tasks/${gearId}$`))
})
