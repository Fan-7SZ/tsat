import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it } from "vitest"

import type { GoalTriggerConfig } from "@/domain/entities/GoalEntity"
import type { TaskTriggerConfig } from "@/domain/entities/TaskGroupEntity"
import { db } from "@/persistence/db"
import {
  applyDailyTriggerResetsAtomic,
  applyRunMutation,
  applyTaskTriggerResetAtomic,
  applyTriggerResetAtomic,
  createGoalWithTriggerAtomic,
  deleteGoalTriggerAtomic,
  deleteGoalTriggerState,
  deleteTask,
  deleteTaskTriggerAtomic,
  deleteTaskTriggerState,
  putActivity,
  putDep,
  putGoal,
  putRepeatLedger,
  putTask,
  rebindTaskGoalAtomic,
  setGoalTriggerAtomic,
  setGoalTriggerWithTaskNormalizationAtomic,
  setTaskTriggerAtomic,
} from "@/persistence/repository"
import {
  dk,
  expectLiveMeta,
  expectTombstone,
  makeActivity,
  makeDep,
  makeGoal,
  makeGoalTaskTree,
  makeLedger,
  makeRun,
  makeTask,
  resetDb,
} from "./helpers"

const dailyTrigger: GoalTriggerConfig = {
  rule: { mode: "daily", interval: 1 },
}

const taskTrigger: TaskTriggerConfig = {
  rule: { mode: "weekly", interval: 1, daysOfWeek: [1] },
}

beforeEach(async () => {
  await resetDb()
})

describe("setGoalTriggerAtomic", () => {
  it("saves the trigger and clears any due date", async () => {
    await putGoal(makeGoal("g1", { dueAt: new Date("2026-07-30T23:59:00") }))
    await putTask(makeTask("t1", { goalId: "g1" }))

    expect(await setGoalTriggerAtomic("g1", dailyTrigger)).toBe("saved")

    const goal = await db.goals.get("g1")
    expect(goal?.trigger).toEqual(dailyTrigger)
    expect(goal?.dueAt).toBeUndefined()
    await expectLiveMeta("goals:g1")
  })

  it("returns goal-not-found without writing anything", async () => {
    expect(await setGoalTriggerAtomic("missing", dailyTrigger)).toBe(
      "goal-not-found"
    )
    expect(await db.recordMeta.count()).toBe(0)
  })

  it("returns repeat-tasks and leaves the goal untouched", async () => {
    const dueAt = new Date("2026-07-30T23:59:00")
    await putGoal(makeGoal("g1", { dueAt }))
    await putTask(
      makeTask("t1", {
        goalId: "g1",
        repeat: { rule: { mode: "daily", interval: 1 } },
      })
    )

    expect(await setGoalTriggerAtomic("g1", dailyTrigger)).toBe("repeat-tasks")

    const goal = await db.goals.get("g1")
    expect(goal?.trigger).toBeUndefined()
    expect(new Date(goal!.dueAt!).getTime()).toBe(dueAt.getTime())
  })
})

describe("setGoalTriggerWithTaskNormalizationAtomic", () => {
  it("returns goal-not-found without normalizing anything", async () => {
    await putTask(
      makeTask("t1", {
        goalId: "missing",
        repeat: { rule: { mode: "daily", interval: 1 } },
      })
    )
    expect(
      await setGoalTriggerWithTaskNormalizationAtomic("missing", dailyTrigger)
    ).toEqual({ result: "goal-not-found", normalizedTaskIds: [] })
    expect((await db.tasks.get("t1"))?.repeat).toBeDefined()
  })

  it("normalizes violating tasks to single-run and clears their ledger/trigger state", async () => {
    await putGoal(makeGoal("g1", { dueAt: new Date("2026-07-30T23:59:00") }))
    await putTask(makeTask("t-ok", { goalId: "g1" }))
    await putTask(
      makeTask("t-multi", { goalId: "g1", total: 3, completedCount: 2 })
    )
    await putTask(
      makeTask("t-repeat", {
        goalId: "g1",
        total: 5,
        repeat: { rule: { mode: "daily", interval: 1 } },
      })
    )
    await putTask(makeTask("t-trig", { goalId: "g1", trigger: taskTrigger }))
    await putRepeatLedger(makeLedger("t-repeat", { "2026-07-20": "planned" }))
    await db.taskTriggerStates.put({
      taskId: "t-trig",
      lastTriggeredDateKey: dk("2026-07-25"),
    })

    const outcome = await setGoalTriggerWithTaskNormalizationAtomic(
      "g1",
      dailyTrigger
    )
    expect(outcome.result).toBe("saved")
    expect([...outcome.normalizedTaskIds].sort()).toEqual([
      "t-multi",
      "t-repeat",
      "t-trig",
    ])

    const goal = await db.goals.get("g1")
    expect(goal?.trigger).toEqual(dailyTrigger)
    expect(goal?.dueAt).toBeUndefined()

    const multi = await db.tasks.get("t-multi")
    expect(multi?.total).toBe(1)
    expect(multi?.completedCount).toBe(1)

    const repeat = await db.tasks.get("t-repeat")
    expect(repeat?.repeat).toBeUndefined()
    expect(repeat?.total).toBe(1)
    expect(await db.repeatLedgers.get("t-repeat")).toBeUndefined()
    await expectTombstone("repeatLedgers:t-repeat")

    const trig = await db.tasks.get("t-trig")
    expect(trig?.trigger).toBeUndefined()
    expect(await db.taskTriggerStates.get("t-trig")).toBeUndefined()
    await expectTombstone("taskTriggerStates:t-trig")

    // Compliant task untouched.
    const ok = await db.tasks.get("t-ok")
    expect(ok?.total).toBe(1)
    expect(ok?.trigger).toBeUndefined()
  })
})

describe("createGoalWithTriggerAtomic", () => {
  it("creates the goal with dueAt stripped", async () => {
    const goal = makeGoal("g1", {
      dueAt: new Date("2026-07-30T23:59:00"),
      trigger: dailyTrigger,
    })
    expect(await createGoalWithTriggerAtomic(goal)).toBe("created")
    const stored = await db.goals.get("g1")
    expect(stored?.trigger).toEqual(dailyTrigger)
    expect(stored?.dueAt).toBeUndefined()
    await expectLiveMeta("goals:g1")
  })

  it("refuses to overwrite an existing goal", async () => {
    await putGoal(makeGoal("g1", { title: "original" }))
    expect(
      await createGoalWithTriggerAtomic(
        makeGoal("g1", { title: "imposter", trigger: dailyTrigger })
      )
    ).toBe("goal-exists")
    expect((await db.goals.get("g1"))?.title).toBe("original")
  })
})

describe("deleteGoalTriggerAtomic", () => {
  it("clears trigger + dueAt and removes the trigger state with a tombstone", async () => {
    await putGoal(
      makeGoal("g1", {
        trigger: dailyTrigger,
        dueAt: new Date("2026-07-30T23:59:00"),
      })
    )
    await db.goalTriggerStates.put({
      goalId: "g1",
      lastTriggeredDateKey: dk("2026-07-25"),
    })

    expect(await deleteGoalTriggerAtomic("g1")).toBe("deleted")

    const goal = await db.goals.get("g1")
    expect(goal?.trigger).toBeUndefined()
    expect(goal?.dueAt).toBeUndefined()
    expect(await db.goalTriggerStates.get("g1")).toBeUndefined()
    await expectLiveMeta("goals:g1")
    await expectTombstone("goalTriggerStates:g1")
  })

  it("returns goal-not-found for an unknown goal", async () => {
    expect(await deleteGoalTriggerAtomic("missing")).toBe("goal-not-found")
    expect(await db.recordMeta.count()).toBe(0)
  })
})

describe("goal/task trigger state deletion", () => {
  it("deleteGoalTriggerState removes the row and tombstones it", async () => {
    await db.goalTriggerStates.put({ goalId: "g1" })
    await deleteGoalTriggerState("g1")
    expect(await db.goalTriggerStates.get("g1")).toBeUndefined()
    await expectTombstone("goalTriggerStates:g1")
  })

  it("deleteTaskTriggerState removes the row and tombstones it", async () => {
    await db.taskTriggerStates.put({ taskId: "t1" })
    await deleteTaskTriggerState("t1")
    expect(await db.taskTriggerStates.get("t1")).toBeUndefined()
    await expectTombstone("taskTriggerStates:t1")
  })
})

describe("setTaskTriggerAtomic", () => {
  it("saves the trigger and clears the task's due date", async () => {
    await putTask(makeTask("t1", { dueAt: new Date("2026-07-28T23:59:00") }))
    expect(await setTaskTriggerAtomic("t1", taskTrigger)).toBe("saved")
    const task = await db.tasks.get("t1")
    expect(task?.trigger).toEqual(taskTrigger)
    expect(task?.dueAt).toBeUndefined()
    await expectLiveMeta("tasks:t1")
  })

  it("returns task-not-found without writing", async () => {
    expect(await setTaskTriggerAtomic("missing", taskTrigger)).toBe(
      "task-not-found"
    )
    expect(await db.recordMeta.count()).toBe(0)
  })

  it("returns repeat-task and leaves the task untouched", async () => {
    await putTask(
      makeTask("t1", { repeat: { rule: { mode: "daily", interval: 1 } } })
    )
    expect(await setTaskTriggerAtomic("t1", taskTrigger)).toBe("repeat-task")
    expect((await db.tasks.get("t1"))?.trigger).toBeUndefined()
  })
})

describe("deleteTaskTriggerAtomic", () => {
  it("clears the trigger and removes the trigger state", async () => {
    await putTask(makeTask("t1", { trigger: taskTrigger }))
    await db.taskTriggerStates.put({
      taskId: "t1",
      lastTriggeredDateKey: dk("2026-07-25"),
    })

    expect(await deleteTaskTriggerAtomic("t1")).toBe("deleted")
    expect((await db.tasks.get("t1"))?.trigger).toBeUndefined()
    expect(await db.taskTriggerStates.get("t1")).toBeUndefined()
    await expectLiveMeta("tasks:t1")
    await expectTombstone("taskTriggerStates:t1")
  })

  it("returns task-not-found for an unknown task", async () => {
    expect(await deleteTaskTriggerAtomic("missing")).toBe("task-not-found")
    expect(await db.recordMeta.count()).toBe(0)
  })
})

describe("applyTaskTriggerResetAtomic", () => {
  it("writes one trigger state per reset and stamps them", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(makeTask("t1", { goalId: "g1" }))
    await putTask(makeTask("t2", { goalId: "g1" }))

    await applyTaskTriggerResetAtomic([
      { taskId: "t1", lastTriggeredDateKey: dk("2026-07-26") },
      { taskId: "t2", lastTriggeredDateKey: dk("2026-07-26") },
    ])
    expect(await db.taskTriggerStates.get("t1")).toEqual({
      taskId: "t1",
      lastTriggeredDateKey: "2026-07-26",
    })
    expect(await db.taskTriggerStates.get("t2")).toBeDefined()
    await expectLiveMeta("taskTriggerStates:t1")
    await expectLiveMeta("taskTriggerStates:t2")

    await applyTaskTriggerResetAtomic([])
    expect(await db.taskTriggerStates.count()).toBe(2)
  })

  it("skips a task that no longer exists instead of recreating its state", async () => {
    await applyTaskTriggerResetAtomic([
      { taskId: "gone", lastTriggeredDateKey: dk("2026-07-26") },
    ])

    expect(await db.taskTriggerStates.get("gone")).toBeUndefined()
    expect(await db.recordMeta.get("taskTriggerStates:gone")).toBeUndefined()
  })
})

describe("applyTriggerResetAtomic", () => {
  it("resets counters, stamps due + trigger state + focus record in one transaction", async () => {
    await putGoal(makeGoal("g1"))
    await putGoal(makeGoal("g2", { dueAt: new Date("2026-07-20T23:59:00") }))
    await putTask(makeTask("t1", { goalId: "g1", completedCount: 2 }))
    await putTask(makeTask("t2", { goalId: "g1", completedCount: 1 }))

    const dueAt = new Date("2026-07-26T23:59:00")
    await applyTriggerResetAtomic([
      {
        goalId: "g1",
        dueAt,
        lastTriggeredDateKey: dk("2026-07-26"),
      },
      {
        goalId: "g2",
        dueAt: undefined,
        lastTriggeredDateKey: dk("2026-07-26"),
      },
    ])

    expect((await db.tasks.get("t1"))?.completedCount).toBe(0)
    expect((await db.tasks.get("t2"))?.completedCount).toBe(0)
    expect(new Date((await db.goals.get("g1"))!.dueAt!).getTime()).toBe(
      dueAt.getTime()
    )
    expect((await db.goals.get("g2"))?.dueAt).toBeUndefined()
    expect(await db.goalTriggerStates.get("g1")).toEqual({
      goalId: "g1",
      lastTriggeredDateKey: "2026-07-26",
    })
    expect(await db.manualFocuses.get("g1")).toEqual({
      goalId: "g1",
      dateKey: "2026-07-26",
      source: "trigger",
    })
    expect(await db.manualFocuses.get("g2")).toBeDefined()
    await expectLiveMeta("tasks:t1")
    await expectLiveMeta("tasks:t2")
    await expectLiveMeta("goals:g1")
    await expectLiveMeta("goalTriggerStates:g1")
    await expectLiveMeta("manualFocuses:g1")
  })

  it("does not write or stamp tasks whose counter is already zero", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(makeTask("t1", { goalId: "g1", completedCount: 0 }))
    await db.recordMeta.delete("tasks:t1")

    await applyTriggerResetAtomic([
      { goalId: "g1", dueAt: undefined, lastTriggeredDateKey: dk("2026-07-26") },
    ])

    expect((await db.tasks.get("t1"))?.completedCount).toBe(0)
    // No fresh stamp: an untouched task keeps its LWW clock, so a deletion
    // made on another device between two fires still wins the merge.
    expect(await db.recordMeta.get("tasks:t1")).toBeUndefined()
    await expectLiveMeta("goalTriggerStates:g1")
  })

  it("keeps the tombstone of a task deleted before the fire", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(makeTask("t1", { goalId: "g1", completedCount: 1 }))
    await deleteTask("t1")

    await applyTriggerResetAtomic([
      { goalId: "g1", dueAt: undefined, lastTriggeredDateKey: dk("2026-07-26") },
    ])

    expect(await db.tasks.get("t1")).toBeUndefined()
    await expectTombstone("tasks:t1")
  })

  it("only resets tasks currently under the goal", async () => {
    await putGoal(makeGoal("g1"))
    await putGoal(makeGoal("g2"))
    await putTask(makeTask("t1", { goalId: "g1", completedCount: 1 }))
    await putTask(makeTask("t2", { goalId: "g2", completedCount: 3 }))

    await applyTriggerResetAtomic([
      { goalId: "g1", dueAt: undefined, lastTriggeredDateKey: dk("2026-07-26") },
    ])

    expect((await db.tasks.get("t1"))?.completedCount).toBe(0)
    expect((await db.tasks.get("t2"))?.completedCount).toBe(3)
  })

  it("skips a goal that no longer exists instead of re-stamping it", async () => {
    await applyTriggerResetAtomic([
      { goalId: "gone", dueAt: undefined, lastTriggeredDateKey: dk("2026-07-26") },
    ])

    expect(await db.goalTriggerStates.get("gone")).toBeUndefined()
    expect(await db.manualFocuses.get("gone")).toBeUndefined()
    expect(await db.recordMeta.get("goals:gone")).toBeUndefined()
  })

  it("drops the previous rounds' completion records so the count cannot come back", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(makeTask("t1", { goalId: "g1", completedCount: 1 }))
    // A round completed under its own run id — the shape that used to survive
    // the reset and be counted again by the next recompute.
    await putActivity(
      makeActivity("act::task-done::t1::run::2026-07-25::1", "t1", {
        runtimeId: "t1::run::2026-07-25::1",
        recordedDateKey: dk("2026-07-25"),
      })
    )
    await putActivity(
      makeActivity("act::task-in-progress::t1", "t1", {
        kind: "task-in-progress",
        recordedDateKey: dk("2026-07-25"),
      })
    )

    await applyTriggerResetAtomic([
      { goalId: "g1", dueAt: undefined, lastTriggeredDateKey: dk("2026-07-26") },
    ])

    expect((await db.tasks.get("t1"))?.completedCount).toBe(0)
    expect(
      await db.activities.get("act::task-done::t1::run::2026-07-25::1")
    ).toBeUndefined()
    await expectTombstone("activities:act::task-done::t1::run::2026-07-25::1")
    // Only completion records are dropped; the run's own history is not.
    expect(await db.activities.get("act::task-in-progress::t1")).toBeDefined()

    // Completing once in the new round lands on 1, not 2.
    await applyRunMutation({
      putActivities: [makeActivity("act::task-done::t1", "t1", { recordedDateKey: dk("2026-07-26") })],
      recomputeCompletedCountFor: ["t1"],
    })
    expect((await db.tasks.get("t1"))?.completedCount).toBe(1)
  })

  it("keeps a completion already dated in the round being started", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(makeTask("t1", { goalId: "g1", completedCount: 0 }))
    // Another device fired first and the task was completed there; this device
    // fires later the same day and must not swallow that completion.
    await putActivity(
      makeActivity("act::task-done::t1", "t1", {
        recordedDateKey: dk("2026-07-26"),
      })
    )

    await applyTriggerResetAtomic([
      { goalId: "g1", dueAt: undefined, lastTriggeredDateKey: dk("2026-07-26") },
    ])

    expect(await db.activities.get("act::task-done::t1")).toBeDefined()
    expect((await db.tasks.get("t1"))?.completedCount).toBe(1)
  })
})

describe("applyDailyTriggerResetsAtomic", () => {
  it("keeps a cross-day run in progress and clears the rest with their in-progress records", async () => {
    await putGoal(makeGoal("g1", { trigger: dailyTrigger }))
    await putTask(makeTask("t-carry", { goalId: "g1", allowCrossDay: true }))
    await putTask(makeTask("t-plain", { goalId: "g1" }))
    await putTask(makeTask("t-idle", { goalId: "g1", allowCrossDay: true }))

    await db.dayRuns.bulkPut([
      makeRun("t-carry", "t-carry", "2026-07-25", {
        arrangementStatus: "inProgress",
      }),
      makeRun("t-plain", "t-plain", "2026-07-25", {
        arrangementStatus: "inProgress",
      }),
      // allowCrossDay but not in progress: no carry-over.
      makeRun("t-idle", "t-idle", "2026-07-25"),
    ])
    await putActivity(
      makeActivity("act::task-in-progress::t-carry", "t-carry", {
        kind: "task-in-progress",
      })
    )
    await putActivity(
      makeActivity("act::task-in-progress::t-plain", "t-plain", {
        kind: "task-in-progress",
      })
    )

    await applyDailyTriggerResetsAtomic({
      goalResets: [
        { goalId: "g1", dueAt: undefined, lastTriggeredDateKey: dk("2026-07-26") },
      ],
      taskResets: [],
      resetTaskIds: ["t-carry", "t-plain", "t-idle"],
    })

    expect(await db.dayRuns.get("t-carry")).toBeDefined()
    expect(await db.activities.get("act::task-in-progress::t-carry")).toBeDefined()
    expect(await db.dayRuns.get("t-plain")).toBeUndefined()
    expect(await db.dayRuns.get("t-idle")).toBeUndefined()
    expect(
      await db.activities.get("act::task-in-progress::t-plain")
    ).toBeUndefined()
    await expectTombstone("activities:act::task-in-progress::t-plain")
    await expectTombstone("dayRuns:t-plain")
  })

  it("leaves a task trigger's cumulative progress and records untouched", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(
      makeTask("t1", {
        goalId: "g1",
        trigger: taskTrigger,
        total: 4,
        completedCount: 2,
      })
    )
    await putActivity(
      makeActivity("act::task-done::t1::run::2026-07-20::1", "t1", {
        runtimeId: "t1::run::2026-07-20::1",
        recordedDateKey: dk("2026-07-20"),
      })
    )
    await putActivity(
      makeActivity("act::task-done::t1::run::2026-07-22::1", "t1", {
        runtimeId: "t1::run::2026-07-22::1",
        recordedDateKey: dk("2026-07-22"),
      })
    )

    await applyDailyTriggerResetsAtomic({
      goalResets: [],
      taskResets: [{ taskId: "t1", lastTriggeredDateKey: dk("2026-07-26") }],
      resetTaskIds: ["t1"],
    })

    expect((await db.tasks.get("t1"))?.completedCount).toBe(2)
    expect(await db.activities.where("taskId").equals("t1").count()).toBe(2)
  })
})

describe("rebindTaskGoalAtomic", () => {
  it("returns task-not-found without touching anything", async () => {
    expect(
      await rebindTaskGoalAtomic({
        taskId: "missing",
        toGoalId: "g1",
        normalize: false,
        newDependencyId: "dep-new",
      })
    ).toEqual({ result: "task-not-found" })
    expect(await db.deps.count()).toBe(0)
    expect(await db.recordMeta.count()).toBe(0)
  })

  it("moves a task between goals, detaching and re-attaching dependency trees", async () => {
    await putGoal(makeGoal("g1"))
    await putGoal(makeGoal("g2"))
    await putTask(makeTask("t1", { goalId: "g1" }))
    await putDep(makeDep("d1", "g1", makeGoalTaskTree("g1", "t1")))
    await putDep(makeDep("d2", "g2", makeGoalTaskTree("g2", "t-other")))

    const outcome = await rebindTaskGoalAtomic({
      taskId: "t1",
      toGoalId: "g2",
      normalize: false,
      newDependencyId: "dep-unused",
    })
    expect(outcome).toEqual({ result: "saved", normalized: false })

    expect((await db.tasks.get("t1"))?.goalId).toBe("g2")

    const oldTree = (await db.deps.get("d1"))!.tree
    expect(oldTree.some((n) => n.data === "t1")).toBe(false)

    const newTree = (await db.deps.get("d2"))!.tree
    const appended = newTree.find((n) => n.data === "t1")
    expect(appended).toEqual({
      data: "t1",
      title: "Task t1",
      parent: null,
      children: null,
    })
    // No new dependency row was created for an existing tree.
    expect(await db.deps.count()).toBe(2)
    await expectLiveMeta("deps:d1")
    await expectLiveMeta("deps:d2")
    await expectLiveMeta("tasks:t1")
  })

  it("creates a new dependency tree when the target goal has none", async () => {
    await putTask(makeTask("t1"))

    const outcome = await rebindTaskGoalAtomic({
      taskId: "t1",
      toGoalId: "g-new",
      normalize: false,
      newDependencyId: "dep-created",
    })
    expect(outcome).toEqual({ result: "saved", normalized: false })

    const created = await db.deps.get("dep-created")
    expect(created?.belongTo).toBe("g-new")
    expect(created?.tree).toEqual([
      { data: "t1", title: "Task t1", parent: null, children: null },
    ])
    await expectLiveMeta("deps:dep-created")
  })

  it("detaches to standalone and normalizes repeat/trigger residue", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(
      makeTask("t1", {
        goalId: "g1",
        total: 4,
        completedCount: 3,
        repeat: { rule: { mode: "daily", interval: 1 } },
      })
    )
    await putDep(makeDep("d1", "g1", makeGoalTaskTree("g1", "t1")))
    await putRepeatLedger(makeLedger("t1", { "2026-07-20": "completed" }))
    await db.taskTriggerStates.put({ taskId: "t1" })

    const outcome = await rebindTaskGoalAtomic({
      taskId: "t1",
      toGoalId: undefined,
      normalize: true,
      newDependencyId: "dep-unused",
    })
    expect(outcome).toEqual({ result: "saved", normalized: true })

    const task = await db.tasks.get("t1")
    expect(task?.goalId).toBeUndefined()
    expect(task?.total).toBe(1)
    expect(task?.completedCount).toBe(1)
    expect(task?.repeat).toBeUndefined()
    expect(task?.trigger).toBeUndefined()
    expect(await db.repeatLedgers.get("t1")).toBeUndefined()
    expect(await db.taskTriggerStates.get("t1")).toBeUndefined()
    await expectTombstone("repeatLedgers:t1")
    await expectTombstone("taskTriggerStates:t1")

    // Old tree no longer references the task; no dep was created.
    expect((await db.deps.get("d1"))!.tree.some((n) => n.data === "t1")).toBe(
      false
    )
    expect(await db.deps.count()).toBe(1)
  })

  it("handles a task with no source goal and no source dependency tree", async () => {
    await putTask(makeTask("t1", { goalId: "g-hasno-dep" }))

    const outcome = await rebindTaskGoalAtomic({
      taskId: "t1",
      toGoalId: "g2",
      normalize: false,
      newDependencyId: "dep-created",
    })
    expect(outcome).toEqual({ result: "saved", normalized: false })
    expect((await db.tasks.get("t1"))?.goalId).toBe("g2")
    expect((await db.deps.get("dep-created"))?.belongTo).toBe("g2")
  })
})
