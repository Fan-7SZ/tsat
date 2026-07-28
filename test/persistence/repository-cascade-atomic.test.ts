import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it } from "vitest"

import { db } from "@/persistence/db"
import {
  applyDailyTriggerResetsAtomic,
  applyRunMutation,
  deleteGoalCascadeAtomic,
  deleteTaskCascadeAtomic,
  putActivity,
  putDismissedTask,
  putGoal,
  putManualFocus,
  putRepeatLedger,
  putTask,
  putTasks,
} from "@/persistence/repository"
import {
  dk,
  expectLiveMeta,
  expectTombstone,
  getMeta,
  makeActivity,
  makeDep,
  makeGoal,
  makeGoalTaskTree,
  makeLedger,
  makeRun,
  makeTask,
  resetDb,
} from "./helpers"

beforeEach(async () => {
  await resetDb()
})

describe("deleteGoalCascadeAtomic", () => {
  it("deletes the goal with every dependent row and tombstones them", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(makeTask("t1", { goalId: "g1" }))
    await db.deps.put(makeDep("d1", "g1", makeGoalTaskTree("g1", "t1")))
    await putActivity(makeActivity("a-task", "t1"))
    await putActivity(makeActivity("a-goal", "t-other", { goalId: "g1" }))
    await putRepeatLedger(makeLedger("t1", { "2026-07-25": "planned" }))
    await db.goalTriggerStates.put({
      goalId: "g1",
      lastTriggeredDateKey: dk("2026-07-26"),
    })
    await db.taskTriggerStates.put({
      taskId: "t1",
      lastTriggeredDateKey: dk("2026-07-26"),
    })
    await db.dayRuns.put(makeRun("t1", "t1", "2026-07-26"))
    await putManualFocus("g1", dk("2026-07-26"))
    await putDismissedTask("t1", dk("2026-07-26"))

    await deleteGoalCascadeAtomic("g1")

    expect(await db.goals.get("g1")).toBeUndefined()
    expect(await db.tasks.get("t1")).toBeUndefined()
    expect(await db.deps.get("d1")).toBeUndefined()
    expect(await db.activities.count()).toBe(0)
    expect(await db.repeatLedgers.get("t1")).toBeUndefined()
    expect(await db.goalTriggerStates.get("g1")).toBeUndefined()
    expect(await db.taskTriggerStates.get("t1")).toBeUndefined()
    expect(await db.dayRuns.count()).toBe(0)
    expect(await db.manualFocuses.get("g1")).toBeUndefined()
    expect(await db.dismissedTasks.get("t1")).toBeUndefined()

    await expectTombstone("goals:g1")
    await expectTombstone("tasks:t1")
    await expectTombstone("deps:d1")
    await expectTombstone("activities:a-task")
    await expectTombstone("activities:a-goal")
    await expectTombstone("repeatLedgers:t1")
    await expectTombstone("goalTriggerStates:g1")
    await expectTombstone("taskTriggerStates:t1")
    await expectTombstone("dayRuns:t1")
    await expectTombstone("manualFocuses:g1")
    await expectTombstone("dismissedTasks:t1")
  })

  it("writes no junk tombstones for rows that never existed", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(makeTask("t1", { goalId: "g1" }))

    await deleteGoalCascadeAtomic("g1")

    expect(await getMeta("repeatLedgers:t1")).toBeUndefined()
    expect(await getMeta("taskTriggerStates:t1")).toBeUndefined()
    expect(await getMeta("goalTriggerStates:g1")).toBeUndefined()
    expect(await getMeta("manualFocuses:g1")).toBeUndefined()
    expect(await getMeta("dismissedTasks:t1")).toBeUndefined()
  })

  it("leaves other goals' data untouched", async () => {
    await putGoal(makeGoal("g1"))
    await putGoal(makeGoal("g2"))
    await putTask(makeTask("t1", { goalId: "g1" }))
    await putTask(makeTask("t2", { goalId: "g2" }))
    await putActivity(makeActivity("a2", "t2", { goalId: "g2" }))

    await deleteGoalCascadeAtomic("g1")

    expect(await db.goals.get("g2")).toBeDefined()
    expect(await db.tasks.get("t2")).toBeDefined()
    expect(await db.activities.get("a2")).toBeDefined()
  })
})

describe("deleteTaskCascadeAtomic", () => {
  it("deletes the task's records and lands the rewired dependency together", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(makeTask("t1", { goalId: "g1" }))
    await db.deps.put(makeDep("d1", "g1", makeGoalTaskTree("g1", "t1")))
    await putActivity(makeActivity("a1", "t1"))
    await putRepeatLedger(makeLedger("t1", { "2026-07-25": "planned" }))
    await db.dayRuns.put(makeRun("t1", "t1", "2026-07-26"))
    await putDismissedTask("t1", dk("2026-07-26"))

    const rewired = makeDep("d1", "g1", [
      { data: "g1", title: "Goal g1", parent: null, children: null },
    ])
    await deleteTaskCascadeAtomic("t1", [rewired])

    expect(await db.tasks.get("t1")).toBeUndefined()
    expect(await db.activities.get("a1")).toBeUndefined()
    expect(await db.repeatLedgers.get("t1")).toBeUndefined()
    expect(await db.dayRuns.count()).toBe(0)
    expect(await db.dismissedTasks.get("t1")).toBeUndefined()
    expect((await db.deps.get("d1"))?.tree).toEqual(rewired.tree)

    await expectTombstone("tasks:t1")
    await expectLiveMeta("deps:d1")
  })

  it("rolls the whole cascade back when the dependency write fails", async () => {
    await putTask(makeTask("t1"))
    await putActivity(makeActivity("a1", "t1"))

    // A dep without its primary key rejects; the already-executed task and
    // activity deletions must roll back with it.
    const invalidDep = { belongTo: "g1", tree: [] }
    await expect(
      deleteTaskCascadeAtomic("t1", [invalidDep as never])
    ).rejects.toThrow()

    expect(await db.tasks.get("t1")).toBeDefined()
    expect(await db.activities.get("a1")).toBeDefined()
    expect(await getMeta("tasks:t1")).toMatchObject({ deletedAt: null })
  })
})

describe("applyDailyTriggerResetsAtomic", () => {
  it("commits goal resets, task resets and run cleanup in one call", async () => {
    await putGoal(
      makeGoal("g1", { trigger: { rule: { mode: "daily", interval: 1 } } })
    )
    await putTask(makeTask("t1", { goalId: "g1", completedCount: 1 }))
    await putTask(
      makeTask("t2", { trigger: { rule: { mode: "daily", interval: 1 } } })
    )
    await db.dayRuns.put(makeRun("t1", "t1", "2026-07-25"))
    await db.dayRuns.put(makeRun("t2", "t2", "2026-07-25"))

    await applyDailyTriggerResetsAtomic({
      goalResets: [
        {
          goalId: "g1",
          dueAt: new Date("2026-07-26T23:59:59.999"),
          lastTriggeredDateKey: dk("2026-07-26"),
        },
      ],
      taskResets: [{ taskId: "t2", lastTriggeredDateKey: dk("2026-07-26") }],
      resetTaskIds: ["t1", "t2"],
    })

    expect((await db.tasks.get("t1"))?.completedCount).toBe(0)
    expect((await db.goals.get("g1"))?.dueAt).toEqual(
      new Date("2026-07-26T23:59:59.999")
    )
    expect(
      (await db.goalTriggerStates.get("g1"))?.lastTriggeredDateKey
    ).toBe("2026-07-26")
    expect(
      (await db.taskTriggerStates.get("t2"))?.lastTriggeredDateKey
    ).toBe("2026-07-26")
    expect((await db.manualFocuses.get("g1"))?.source).toBe("trigger")
    expect(await db.dayRuns.count()).toBe(0)
    await expectTombstone("dayRuns:t1")
    await expectTombstone("dayRuns:t2")
  })

  it("rolls back the goal reset when the task reset fails", async () => {
    await putGoal(
      makeGoal("g1", { trigger: { rule: { mode: "daily", interval: 1 } } })
    )
    await putTask(makeTask("t1", { goalId: "g1", completedCount: 1 }))

    // A task reset without its primary key rejects mid-transaction.
    const invalidReset = { lastTriggeredDateKey: dk("2026-07-26") }
    await expect(
      applyDailyTriggerResetsAtomic({
        goalResets: [
          {
            goalId: "g1",
            dueAt: undefined,
            lastTriggeredDateKey: dk("2026-07-26"),
          },
        ],
        taskResets: [invalidReset as never],
        resetTaskIds: ["t1"],
      })
    ).rejects.toThrow()

    expect((await db.tasks.get("t1"))?.completedCount).toBe(1)
    expect(await db.goalTriggerStates.get("g1")).toBeUndefined()
    expect(await db.manualFocuses.get("g1")).toBeUndefined()
  })
})

describe("applyRunMutation retractDoneRunIds", () => {
  it("flips a done run back to todo and recounts in the same tx", async () => {
    await putTask(makeTask("t1", { total: 3, completedCount: 1 }))
    await putActivity(makeActivity("act::task-done::t1", "t1"))
    await db.dayRuns.put(
      makeRun("t1", "t1", "2026-07-26", {
        arrangementStatus: "done",
        source: "manual",
      })
    )

    // The removeCompletionRecord write-set: record out, run retracted, count
    // re-projected — one transaction.
    await applyRunMutation({
      deleteActivityIds: ["act::task-done::t1"],
      retractDoneRunIds: ["t1"],
      recomputeCompletedCountFor: ["t1"],
    })

    expect((await db.dayRuns.get("t1"))?.arrangementStatus).toBe("todo")
    expect((await db.tasks.get("t1"))?.completedCount).toBe(0)
    await expectLiveMeta("dayRuns:t1")
  })

  it("leaves a non-done run untouched and no-ops on a missing id", async () => {
    await db.dayRuns.put(
      makeRun("t1", "t1", "2026-07-26", { arrangementStatus: "inProgress" })
    )

    await applyRunMutation({ retractDoneRunIds: ["t1", "missing"] })

    expect((await db.dayRuns.get("t1"))?.arrangementStatus).toBe("inProgress")
    expect(await getMeta("dayRuns:t1")).toBeUndefined()
    expect(await db.dayRuns.get("missing")).toBeUndefined()
  })
})

describe("putTasks with ledgerSync", () => {
  it("lands tasks and their ledgers in one transaction", async () => {
    const ledger = makeLedger("t-repeat", { "2026-07-26": "planned" })

    await putTasks(
      [
        makeTask("t-plain"),
        makeTask("t-repeat", {
          repeat: { rule: { mode: "daily", interval: 1 } },
        }),
      ],
      [
        { taskId: "t-plain", ledger: null },
        { taskId: "t-repeat", ledger },
      ]
    )

    expect(await db.tasks.count()).toBe(2)
    expect((await db.repeatLedgers.get("t-repeat"))?.points).toEqual(
      ledger.points
    )
    await expectLiveMeta("repeatLedgers:t-repeat")
    // No ledger ever existed for the plain task — no tombstone either.
    expect(await getMeta("repeatLedgers:t-plain")).toBeUndefined()
  })

  it("a null ledger deletes an existing one with a tombstone", async () => {
    await putRepeatLedger(makeLedger("t1", { "2026-07-25": "planned" }))

    await putTasks([makeTask("t1")], [{ taskId: "t1", ledger: null }])

    expect(await db.repeatLedgers.get("t1")).toBeUndefined()
    await expectTombstone("repeatLedgers:t1")
  })
})
