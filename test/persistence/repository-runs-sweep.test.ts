import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it } from "vitest"

import type { TaskRuntimeID } from "@/domain/value-objects/types"
import { db } from "@/persistence/db"
import {
  applyReplanAtomic,
  applyRunMutation,
  deleteAutoRunsForGoal,
  deleteDayRunsByTasks,
  gcStaleIntentRecords,
  putActivity,
  putDismissedTask,
  putGoal,
  putManualFocus,
  putRepeatLedger,
  putTask,
  sweepDayBoundaryAtomic,
} from "@/persistence/repository"
import {
  dk,
  expectLiveMeta,
  expectTombstone,
  getMeta,
  makeActivity,
  makeGoal,
  makeLedger,
  makeRun,
  makeTask,
  resetDb,
} from "./helpers"

beforeEach(async () => {
  await resetDb()
})

describe("applyRunMutation", () => {
  it("no-ops on an empty mutation", async () => {
    await applyRunMutation({})
    expect(await db.dayRuns.count()).toBe(0)
    expect(await db.recordMeta.count()).toBe(0)
  })

  it("applies a full write-set atomically and recomputes completedCount from the same tx", async () => {
    await putTask(makeTask("t-counter", { total: 3, completedCount: 0 }))
    await putTask(
      makeTask("t-repeat", {
        total: 10,
        completedCount: 0,
        repeat: { rule: { mode: "daily", interval: 1 } },
      })
    )
    await putRepeatLedger(makeLedger("t-repeat", { "2026-07-25": "planned" }))
    await db.dayRuns.put(makeRun("stale-run", "t-old", "2026-07-25"))
    await putActivity(makeActivity("a-old", "t-old"))
    await putDismissedTask("t-undismiss", dk("2026-07-26"))

    await applyRunMutation({
      putRuns: [
        makeRun("t-counter", "t-counter", "2026-07-26", {
          arrangementStatus: "done",
        }),
      ],
      deleteRunIds: ["stale-run"],
      putActivities: [makeActivity("a-done", "t-counter")],
      deleteActivityIds: ["a-old"],
      taskPatches: [
        { taskId: "t-counter", patch: { notes: "patched" } },
        { taskId: "t-missing", patch: { notes: "never lands" } },
      ],
      ledgerMarks: [
        { taskId: "t-repeat", dateKey: dk("2026-07-25"), status: "completed" },
        { taskId: "t-noledger", dateKey: dk("2026-07-25"), status: "completed" },
      ],
      putDismissals: [{ taskId: "t-dismiss", dateKey: dk("2026-07-26") }],
      deleteDismissalTaskIds: ["t-undismiss"],
      recomputeCompletedCountFor: ["t-counter", "t-repeat", "t-missing"],
    })

    expect((await db.dayRuns.get("t-counter"))?.arrangementStatus).toBe("done")
    expect(await db.dayRuns.get("stale-run")).toBeUndefined()
    expect(await db.activities.get("a-done")).toBeDefined()
    expect(await db.activities.get("a-old")).toBeUndefined()
    expect((await db.tasks.get("t-counter"))?.notes).toBe("patched")
    expect((await db.repeatLedgers.get("t-repeat"))?.points).toEqual({
      "2026-07-25": "completed",
    })
    expect(await db.dismissedTasks.get("t-dismiss")).toBeDefined()
    expect(await db.dismissedTasks.get("t-undismiss")).toBeUndefined()

    // completedCount projected from the records written in the same tx.
    expect((await db.tasks.get("t-counter"))?.completedCount).toBe(1)
    expect((await db.tasks.get("t-repeat"))?.completedCount).toBe(1)

    await expectLiveMeta("dayRuns:t-counter")
    await expectTombstone("dayRuns:stale-run")
    await expectLiveMeta("activities:a-done")
    await expectTombstone("activities:a-old")
    await expectLiveMeta("tasks:t-counter")
    await expectLiveMeta("repeatLedgers:t-repeat")
    await expectLiveMeta("dismissedTasks:t-dismiss")
    await expectTombstone("dismissedTasks:t-undismiss")
  })

  it("recompute treats a repeat task without a ledger as zero", async () => {
    await putTask(
      makeTask("t-repeat", {
        completedCount: 7,
        repeat: { rule: { mode: "daily", interval: 1 } },
      })
    )
    await applyRunMutation({ recomputeCompletedCountFor: ["t-repeat"] })
    expect((await db.tasks.get("t-repeat"))?.completedCount).toBe(0)
  })

  it("rolls back every earlier write when a later write in the mutation fails", async () => {
    // Runs are written before activities inside the transaction; the invalid
    // activity (missing primary key) rejects and must abort the whole tx.
    const badActivity = { kind: "task-done", taskId: "t1" }
    await expect(
      applyRunMutation({
        putRuns: [makeRun("r-first", "t1", "2026-07-26")],
        putActivities: [badActivity as never],
      })
    ).rejects.toThrow()

    expect(await db.dayRuns.count()).toBe(0)
    expect(await db.activities.count()).toBe(0)
    expect(await db.recordMeta.count()).toBe(0)
  })
})

describe("applyReplanAtomic", () => {
  it("feeds the planner a snapshot + runs and commits its diff in one transaction", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(makeTask("t1", { goalId: "g1" }))
    await db.dayRuns.put(makeRun("old-run", "t-old", "2026-07-25"))

    const result = await applyReplanAtomic((snapshot, runs) => {
      expect(snapshot.goals["g1"]?.createdAt).toBeInstanceOf(Date)
      expect(snapshot.tasks["t1"]?.title).toBe("Task t1")
      expect(runs.map((r) => r.id)).toEqual(["old-run"])
      return {
        putRuns: [makeRun("t1", "t1", "2026-07-26")],
        deleteRunIds: ["old-run"],
        result: "planned" as const,
      }
    })

    expect(result).toBe("planned")
    expect((await db.dayRuns.toArray()).map((r) => r.id)).toEqual(["t1"])
    await expectLiveMeta("dayRuns:t1")
    await expectTombstone("dayRuns:old-run")
  })

  it("commits nothing when the compute callback throws", async () => {
    await db.dayRuns.put(makeRun("keep", "t1", "2026-07-25"))
    await expect(
      applyReplanAtomic(() => {
        throw new Error("planner exploded")
      })
    ).rejects.toThrow("planner exploded")
    expect((await db.dayRuns.toArray()).map((r) => r.id)).toEqual(["keep"])
    expect(await db.recordMeta.count()).toBe(0)
  })
})

describe("deleteAutoRunsForGoal", () => {
  it("drops only default-source, still-todo runs of the goal's tasks", async () => {
    await putTask(makeTask("t1", { goalId: "g1" }))
    await putTask(makeTask("t2", { goalId: "g1" }))
    await putTask(makeTask("t3", { goalId: "g2" }))
    await db.dayRuns.bulkPut([
      makeRun("t1", "t1", "2026-07-26"),
      makeRun("t2", "t2", "2026-07-26", { arrangementStatus: "inProgress" }),
      makeRun("t2::second", "t2", "2026-07-26", { source: "manual" }),
      makeRun("t3", "t3", "2026-07-26"),
    ])

    await deleteAutoRunsForGoal("g1")

    const remaining = (await db.dayRuns.toArray()).map((r) => r.id).sort()
    expect(remaining).toEqual(["t2", "t2::second", "t3"])
    await expectTombstone("dayRuns:t1")
  })

  it("returns early for a goal with no tasks", async () => {
    await db.dayRuns.put(makeRun("t1", "t1", "2026-07-26"))
    await deleteAutoRunsForGoal("g-empty")
    expect(await db.dayRuns.count()).toBe(1)
  })
})

describe("deleteDayRunsByTasks", () => {
  it("no-ops on an empty task list", async () => {
    await db.dayRuns.put(makeRun("t1", "t1", "2026-07-26"))
    await deleteDayRunsByTasks([])
    expect(await db.dayRuns.count()).toBe(1)
  })

  it("drops every run of the listed tasks regardless of status/source", async () => {
    await db.dayRuns.bulkPut([
      makeRun("t1", "t1", "2026-07-26", { arrangementStatus: "done" }),
      makeRun("t1::2026-07-25", "t1", "2026-07-25", { source: "manual" }),
      makeRun("t2", "t2", "2026-07-26"),
    ])

    await deleteDayRunsByTasks(["t1"])

    expect((await db.dayRuns.toArray()).map((r) => r.id)).toEqual(["t2"])
    await expectTombstone("dayRuns:t1")
    await expectTombstone("dayRuns:t1::2026-07-25")
  })
})

describe("sweepDayBoundaryAtomic", () => {
  it("carries intent forward additively and sweeps stale runs in one transaction", async () => {
    const today = dk("2026-07-26")
    // Intent state from yesterday.
    await putManualFocus("g-kept", dk("2026-07-25"), "trigger")
    await putManualFocus("g-stale", dk("2026-07-25"))
    await putDismissedTask("t-dismissed", dk("2026-07-25"))
    // Runs: one carries over, one is swept, one already belongs to today.
    await db.dayRuns.bulkPut([
      makeRun("r-carry", "t-carry", "2026-07-25", {
        arrangementStatus: "inProgress",
      }),
      makeRun("r-stale", "t-stale", "2026-07-25"),
      makeRun("r-today", "t-today", "2026-07-26"),
    ])

    await sweepDayBoundaryAtomic(
      new Set(["g-kept"]),
      new Set<TaskRuntimeID>(["r-carry"]),
      today
    )

    // Kept focus is refreshed to today and demoted to manual source.
    expect(await db.manualFocuses.get("g-kept")).toEqual({
      goalId: "g-kept",
      dateKey: "2026-07-26",
      source: "manual",
    })
    await expectLiveMeta("manualFocuses:g-kept")
    // Non-carried intent records stay as-is: their old dateKey makes them
    // inert to every reader, no tombstone races another device's day.
    expect(await db.manualFocuses.get("g-stale")).toEqual({
      goalId: "g-stale",
      dateKey: "2026-07-25",
      source: "manual",
    })
    expect(await getMeta("manualFocuses:g-stale")).toMatchObject({
      deletedAt: null,
    })
    expect(await db.dismissedTasks.get("t-dismissed")).toBeDefined()
    expect(await getMeta("dismissedTasks:t-dismissed")).toMatchObject({
      deletedAt: null,
    })

    // Carry-over run rewritten to today; stale run deleted; today's untouched.
    const carried = await db.dayRuns.get("r-carry")
    expect(carried?.dateKey).toBe("2026-07-26")
    expect(carried?.arrangementStatus).toBe("inProgress")
    await expectLiveMeta("dayRuns:r-carry")
    expect(await db.dayRuns.get("r-stale")).toBeUndefined()
    await expectTombstone("dayRuns:r-stale")
    expect((await db.dayRuns.get("r-today"))?.dateKey).toBe("2026-07-26")
  })

  it("is idempotent: a second sweep of the same day writes nothing new", async () => {
    const today = dk("2026-07-26")
    await putManualFocus("g-kept", dk("2026-07-25"))
    await db.dayRuns.bulkPut([
      makeRun("r-carry", "t-carry", "2026-07-25", {
        arrangementStatus: "inProgress",
      }),
      makeRun("r-stale", "t-stale", "2026-07-25"),
    ])

    const sweep = () =>
      sweepDayBoundaryAtomic(
        new Set(["g-kept"]),
        new Set<TaskRuntimeID>(["r-carry"]),
        today
      )
    await sweep()
    const focusMetaAfterFirst = await getMeta("manualFocuses:g-kept")
    const carryMetaAfterFirst = await getMeta("dayRuns:r-carry")

    await sweep()

    // Same rows, same stamps — the second pass found nothing left to change,
    // so no fresh updatedAt leaks into the sync channel.
    expect(await getMeta("manualFocuses:g-kept")).toEqual(focusMetaAfterFirst)
    expect(await getMeta("dayRuns:r-carry")).toEqual(carryMetaAfterFirst)
    expect(await db.dayRuns.get("r-stale")).toBeUndefined()
  })
})

describe("gcStaleIntentRecords", () => {
  it("tombstones only records beyond the horizon", async () => {
    await putManualFocus("g-old", dk("2026-07-10"))
    await putManualFocus("g-fresh", dk("2026-07-25"))
    await putDismissedTask("t-old", dk("2026-07-10"))
    await putDismissedTask("t-fresh", dk("2026-07-26"))

    const removed = await gcStaleIntentRecords(dk("2026-07-19"))

    expect(removed).toBe(2)
    expect(await db.manualFocuses.get("g-old")).toBeUndefined()
    await expectTombstone("manualFocuses:g-old")
    expect(await db.manualFocuses.get("g-fresh")).toBeDefined()
    expect(await db.dismissedTasks.get("t-old")).toBeUndefined()
    await expectTombstone("dismissedTasks:t-old")
    expect(await db.dismissedTasks.get("t-fresh")).toBeDefined()
  })
})
