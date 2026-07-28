import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it } from "vitest"

import { PRESET_TAGS } from "@/domain/entities/preset-tags"
import { db } from "@/persistence/db"
import {
  deleteActivitiesByGoal,
  deleteActivitiesByTask,
  deleteActivity,
  deleteDep,
  deleteDismissedTask,
  deleteGoal,
  deleteManualFocus,
  deleteRepeatLedger,
  deleteTag,
  deleteTagAndUnbindGoals,
  deleteTask,
  ensureTagCatalogReady,
  markRepeatPoint,
  patchActivityDate,
  patchDep,
  patchGoal,
  patchTask,
  putActivity,
  putDep,
  putDismissedTask,
  putGoal,
  putLastFullReplanDateKey,
  putManualFocus,
  putRepeatLedger,
  putTag,
  putTask,
  putTasks,
  queryActivitiesByGoal,
  queryActivitiesByTask,
  queryActivitiesByTasks,
  queryAllActivities,
  queryAllDeps,
  queryAllDismissedTasks,
  queryAllGoals,
  queryAllRepeatLedgers,
  queryAllTags,
  queryAllTasks,
  queryAppMetaRows,
  queryDayRun,
  queryDayRuns,
  queryDayRunsByTask,
  queryDependencyByGoal,
  queryDependencyById,
  queryEntitySnapshot,
  queryGoalById,
  queryLastFullReplanDateKey,
  queryRecentActivities,
  queryRepeatLedger,
  queryTaskById,
  queryTasksByGoal,
  recomputeCompletedCount,
  LAST_FULL_REPLAN_KEY,
} from "@/persistence/repository"
import {
  dk,
  expectLiveMeta,
  expectTombstone,
  getMeta,
  makeActivity,
  makeDep,
  makeGoal,
  makeLedger,
  makeRun,
  makeTag,
  makeTask,
  resetDb,
} from "./helpers"

beforeEach(async () => {
  await resetDb()
})

describe("tags", () => {
  it("ensureTagCatalogReady seeds preset tags once and re-adds only missing ones", async () => {
    await ensureTagCatalogReady()
    expect(await db.tags.count()).toBe(PRESET_TAGS.length)

    // Second call adds nothing.
    await ensureTagCatalogReady()
    expect(await db.tags.count()).toBe(PRESET_TAGS.length)

    // A deleted preset comes back; existing rows are not overwritten.
    await db.tags.delete(PRESET_TAGS[0]!.id)
    await ensureTagCatalogReady()
    expect(await db.tags.count()).toBe(PRESET_TAGS.length)
    expect(await db.tags.get(PRESET_TAGS[0]!.id)).toBeDefined()
  })

  it("queryAllTags sorts presets first, then by name", async () => {
    await ensureTagCatalogReady()
    await putTag(makeTag("tag-b", "beta"))
    await putTag(makeTag("tag-a", "Alpha"))

    const tags = await queryAllTags()
    const presetNames = [...PRESET_TAGS.map((t) => t.name)].sort((a, b) =>
      a.localeCompare(b)
    )
    expect(tags.map((t) => t.name)).toEqual([
      ...presetNames,
      "Alpha",
      "beta",
    ])
  })

  it("putTag / deleteTag stamp recordMeta", async () => {
    await putTag(makeTag("tag-x", "X"))
    expect(await db.tags.get("tag-x")).toBeDefined()
    await expectLiveMeta("tags:tag-x")

    await deleteTag("tag-x")
    expect(await db.tags.get("tag-x")).toBeUndefined()
    await expectTombstone("tags:tag-x")
  })

  it("deleteTagAndUnbindGoals clears tagId only on affected goals, atomically", async () => {
    await putTag(makeTag("tag-x", "X"))
    await putGoal(makeGoal("g1", { tagId: "tag-x" }))
    await putGoal(makeGoal("g2", { tagId: "tag-x" }))
    await putGoal(makeGoal("g3", { tagId: "tag-other" }))

    await deleteTagAndUnbindGoals("tag-x")

    expect((await db.goals.get("g1"))?.tagId).toBeUndefined()
    expect((await db.goals.get("g2"))?.tagId).toBeUndefined()
    expect((await db.goals.get("g3"))?.tagId).toBe("tag-other")
    expect(await db.tags.get("tag-x")).toBeUndefined()
    await expectLiveMeta("goals:g1")
    await expectLiveMeta("goals:g2")
    await expectTombstone("tags:tag-x")
  })
})

describe("goals", () => {
  it("putGoal round-trips and revives dates including custom trigger rule dates", async () => {
    const fireDates = [new Date("2026-08-01T00:00:00")]
    await putGoal(
      makeGoal("g1", {
        dueAt: new Date("2026-07-30T23:59:00"),
        trigger: { rule: { mode: "custom", date: fireDates } },
      })
    )
    await putGoal(
      makeGoal("g2", { trigger: { rule: { mode: "daily", interval: 2 } } })
    )

    const g1 = await queryGoalById("g1")
    expect(g1?.createdAt).toBeInstanceOf(Date)
    expect(g1?.dueAt).toBeInstanceOf(Date)
    expect(g1?.dueAt?.getTime()).toBe(
      new Date("2026-07-30T23:59:00").getTime()
    )
    expect(g1?.trigger?.rule.mode).toBe("custom")
    if (g1?.trigger?.rule.mode === "custom") {
      expect(g1.trigger.rule.date[0]).toBeInstanceOf(Date)
      expect(g1.trigger.rule.date[0]?.getTime()).toBe(fireDates[0]!.getTime())
    }

    const all = await queryAllGoals()
    expect(all.map((g) => g.id).sort()).toEqual(["g1", "g2"])
    expect(await queryGoalById("missing")).toBeNull()
    await expectLiveMeta("goals:g1")
  })

  it("patchGoal updates existing goals and skips the meta stamp when nothing matched", async () => {
    await putGoal(makeGoal("g1"))
    expect(await patchGoal("g1", { title: "renamed" })).toBe(1)
    expect((await queryGoalById("g1"))?.title).toBe("renamed")

    expect(await patchGoal("missing", { title: "nope" })).toBe(0)
    expect(await getMeta("goals:missing")).toBeUndefined()
  })

  it("deleteGoal removes the row and tombstones it", async () => {
    await putGoal(makeGoal("g1"))
    await deleteGoal("g1")
    expect(await queryGoalById("g1")).toBeNull()
    await expectTombstone("goals:g1")
  })
})

describe("tasks", () => {
  it("putTask round-trips and revives repeat/trigger window dates", async () => {
    await putTask(
      makeTask("t1", {
        goalId: "g1",
        dueAt: new Date("2026-07-28T23:59:00"),
        repeat: {
          rule: { mode: "weekly", interval: 1, daysOfWeek: [1, 3] },
          startsAt: new Date("2026-07-01T00:00:00"),
          endsAt: new Date("2026-09-01T00:00:00"),
        },
      })
    )
    await putTask(
      makeTask("t2", {
        goalId: "g1",
        trigger: {
          rule: { mode: "custom", date: [new Date("2026-08-15T00:00:00")] },
          startsAt: new Date("2026-07-01T00:00:00"),
          endsAt: new Date("2026-10-01T00:00:00"),
        },
      })
    )
    await putTask(makeTask("t3", { goalId: "g-other" }))

    const t1 = await queryTaskById("t1")
    expect(t1?.createdAt).toBeInstanceOf(Date)
    expect(t1?.dueAt).toBeInstanceOf(Date)
    expect(t1?.repeat?.startsAt).toBeInstanceOf(Date)
    expect(t1?.repeat?.endsAt).toBeInstanceOf(Date)

    const t2 = await queryTaskById("t2")
    expect(t2?.trigger?.startsAt).toBeInstanceOf(Date)
    expect(t2?.trigger?.endsAt).toBeInstanceOf(Date)
    if (t2?.trigger?.rule.mode === "custom") {
      expect(t2.trigger.rule.date[0]).toBeInstanceOf(Date)
    } else {
      throw new Error("expected custom trigger rule")
    }

    expect(await queryTaskById("missing")).toBeNull()
    expect((await queryAllTasks()).length).toBe(3)
    expect((await queryTasksByGoal("g1")).map((t) => t.id).sort()).toEqual([
      "t1",
      "t2",
    ])
  })

  it("putTasks writes all tasks in one transaction and no-ops on empty input", async () => {
    await putTasks([])
    expect(await db.tasks.count()).toBe(0)

    await putTasks([makeTask("t1"), makeTask("t2")])
    expect(await db.tasks.count()).toBe(2)
    await expectLiveMeta("tasks:t1")
    await expectLiveMeta("tasks:t2")
  })

  it("patchTask / deleteTask update the row and its meta", async () => {
    await putTask(makeTask("t1"))
    expect(await patchTask("t1", { total: 3 })).toBe(1)
    expect((await queryTaskById("t1"))?.total).toBe(3)
    expect(await patchTask("missing", { total: 3 })).toBe(0)
    expect(await getMeta("tasks:missing")).toBeUndefined()

    await deleteTask("t1")
    expect(await queryTaskById("t1")).toBeNull()
    await expectTombstone("tasks:t1")
  })

  it("recomputeCompletedCount projects task-done activities for non-repeat tasks", async () => {
    await putTask(makeTask("t1", { total: 3, completedCount: 0 }))
    await putActivity(makeActivity("a1", "t1"))
    await putActivity(makeActivity("a2", "t1", { kind: "task-in-progress" }))
    await putActivity(
      makeActivity("a3", "t1", {
        recordedAt: new Date("2026-07-21T12:00:00"),
      })
    )

    await recomputeCompletedCount("t1")
    expect((await queryTaskById("t1"))?.completedCount).toBe(2)

    // Already-consistent count: no further patch needed.
    await recomputeCompletedCount("t1")
    expect((await queryTaskById("t1"))?.completedCount).toBe(2)
  })

  it("recomputeCompletedCount counts completed ledger points for repeat tasks", async () => {
    await putTask(
      makeTask("t1", {
        total: 10,
        completedCount: 0,
        repeat: { rule: { mode: "daily", interval: 1 } },
      })
    )
    await putRepeatLedger(
      makeLedger("t1", {
        "2026-07-18": "completed",
        "2026-07-19": "planned",
        "2026-07-20": "skipped",
        "2026-07-21": "completed",
      })
    )
    await recomputeCompletedCount("t1")
    expect((await queryTaskById("t1"))?.completedCount).toBe(2)

    // Repeat task without a ledger counts zero.
    await putTask(
      makeTask("t2", {
        completedCount: 4,
        repeat: { rule: { mode: "daily", interval: 1 } },
      })
    )
    await recomputeCompletedCount("t2")
    expect((await queryTaskById("t2"))?.completedCount).toBe(0)

    // Missing task is a no-op.
    await recomputeCompletedCount("missing")
  })
})

describe("dependencies", () => {
  it("supports CRUD and lookups by goal and id", async () => {
    await putDep(makeDep("d1", "g1"))
    await expectLiveMeta("deps:d1")

    expect((await queryAllDeps()).length).toBe(1)
    expect((await queryDependencyByGoal("g1"))?.id).toBe("d1")
    expect(await queryDependencyByGoal("missing")).toBeNull()
    expect((await queryDependencyById("d1"))?.belongTo).toBe("g1")
    expect(await queryDependencyById("missing")).toBeNull()

    expect(
      await patchDep("d1", {
        tree: [{ data: "g1", title: "root", parent: null, children: null }],
      })
    ).toBe(1)
    expect((await queryDependencyById("d1"))?.tree.length).toBe(1)
    expect(await patchDep("missing", { tree: [] })).toBe(0)

    await deleteDep("d1")
    expect(await queryDependencyById("d1")).toBeNull()
    await expectTombstone("deps:d1")
  })
})

describe("activities", () => {
  it("putActivity / deleteActivity / patchActivityDate manage single rows", async () => {
    await putActivity(makeActivity("a1", "t1"))
    await expectLiveMeta("activities:a1")

    expect(await patchActivityDate("a1", dk("2026-07-25"))).toBe(1)
    const all = await queryAllActivities()
    expect(all[0]?.recordedDateKey).toBe("2026-07-25")
    expect(all[0]?.recordedAt).toBeInstanceOf(Date)
    expect(await patchActivityDate("missing", dk("2026-07-25"))).toBe(0)

    await deleteActivity("a1")
    expect((await queryAllActivities()).length).toBe(0)
    await expectTombstone("activities:a1")
  })

  it("revives plannedForDate when present", async () => {
    await putActivity(
      makeActivity("a1", "t1", { plannedForDate: dk("2026-07-19") })
    )
    const all = await queryAllActivities()
    expect(all[0]?.plannedForDate).toBe("2026-07-19")
  })

  it("deleteActivitiesByTask / deleteActivitiesByGoal delete and tombstone only matching rows", async () => {
    await putActivity(makeActivity("a1", "t1", { goalId: "g1" }))
    await putActivity(
      makeActivity("a2", "t1", {
        goalId: "g1",
        recordedAt: new Date("2026-07-20T13:00:00"),
      })
    )
    await putActivity(makeActivity("a3", "t2", { goalId: "g2" }))

    expect(await deleteActivitiesByTask("t1")).toBe(2)
    await expectTombstone("activities:a1")
    await expectTombstone("activities:a2")
    expect((await queryAllActivities()).map((a) => a.id)).toEqual(["a3"])

    expect(await deleteActivitiesByGoal("g2")).toBe(1)
    await expectTombstone("activities:a3")
    expect((await queryAllActivities()).length).toBe(0)

    // No matching rows: nothing to delete, nothing to tombstone.
    expect(await deleteActivitiesByTask("t-none")).toBe(0)
  })

  it("queryRecentActivities returns newest first with a limit", async () => {
    for (let i = 1; i <= 4; i++) {
      await putActivity(
        makeActivity(`a${i}`, "t1", {
          recordedAt: new Date(`2026-07-2${i}T08:00:00`),
        })
      )
    }
    const recent = await queryRecentActivities(2)
    expect(recent.map((a) => a.id)).toEqual(["a4", "a3"])
  })

  it("queryActivitiesByTask / queryActivitiesByGoal use compound indexes, newest first", async () => {
    await putActivity(
      makeActivity("a1", "t1", {
        goalId: "g1",
        recordedAt: new Date("2026-07-20T08:00:00"),
      })
    )
    await putActivity(
      makeActivity("a2", "t1", {
        goalId: "g1",
        recordedAt: new Date("2026-07-21T08:00:00"),
      })
    )
    await putActivity(makeActivity("a3", "t2", { goalId: "g2" }))

    expect((await queryActivitiesByTask("t1")).map((a) => a.id)).toEqual([
      "a2",
      "a1",
    ])
    expect((await queryActivitiesByGoal("g1", 1)).map((a) => a.id)).toEqual([
      "a2",
    ])
    expect((await queryActivitiesByGoal("g-missing")).length).toBe(0)
  })

  it("queryActivitiesByTasks groups by task and short-circuits on empty input", async () => {
    expect((await queryActivitiesByTasks([])).size).toBe(0)

    await putActivity(makeActivity("a1", "t1"))
    await putActivity(
      makeActivity("a2", "t1", {
        recordedAt: new Date("2026-07-21T08:00:00"),
      })
    )
    await putActivity(makeActivity("a3", "t2"))
    await putActivity(makeActivity("a4", "t3"))

    const map = await queryActivitiesByTasks(["t1", "t2"])
    expect(map.size).toBe(2)
    expect(map.get("t1")?.map((a) => a.id).sort()).toEqual(["a1", "a2"])
    expect(map.get("t2")?.map((a) => a.id)).toEqual(["a3"])
    expect(map.has("t3")).toBe(false)
  })
})

describe("intent tables", () => {
  it("manual focus rows are stamped on put and tombstoned on delete", async () => {
    await putManualFocus("g1", dk("2026-07-26"))
    expect(await db.manualFocuses.get("g1")).toEqual({
      goalId: "g1",
      dateKey: "2026-07-26",
      source: "manual",
    })
    await expectLiveMeta("manualFocuses:g1")

    await putManualFocus("g2", dk("2026-07-26"), "trigger")
    expect((await db.manualFocuses.get("g2"))?.source).toBe("trigger")

    await deleteManualFocus("g1")
    expect(await db.manualFocuses.get("g1")).toBeUndefined()
    await expectTombstone("manualFocuses:g1")
  })

  it("dismissed tasks are stamped on put and tombstoned on delete", async () => {
    await putDismissedTask("t1", dk("2026-07-26"))
    expect(await queryAllDismissedTasks()).toEqual([
      { taskId: "t1", dateKey: "2026-07-26" },
    ])
    await expectLiveMeta("dismissedTasks:t1")

    await deleteDismissedTask("t1")
    expect((await queryAllDismissedTasks()).length).toBe(0)
    await expectTombstone("dismissedTasks:t1")
  })
})

describe("app meta", () => {
  it("stores the last-full-replan date key and parses only strings", async () => {
    expect(await queryLastFullReplanDateKey()).toBeNull()

    await putLastFullReplanDateKey(dk("2026-07-26"))
    expect(await queryLastFullReplanDateKey()).toBe("2026-07-26")
    await expectLiveMeta(`appMeta:${LAST_FULL_REPLAN_KEY}`)
    expect(await queryAppMetaRows()).toEqual([
      { key: LAST_FULL_REPLAN_KEY, value: "2026-07-26" },
    ])

    // Non-string values read as null.
    await db.appMeta.put({ key: LAST_FULL_REPLAN_KEY, value: 42 })
    expect(await queryLastFullReplanDateKey()).toBeNull()
  })
})

describe("day runs (read paths)", () => {
  it("queries all runs, one run by id, and runs by task", async () => {
    await db.dayRuns.bulkPut([
      makeRun("t1", "t1", "2026-07-26"),
      makeRun("t1::2026-07-25", "t1", "2026-07-25"),
      makeRun("t2", "t2", "2026-07-26"),
    ])

    expect((await queryDayRuns()).length).toBe(3)
    expect((await queryDayRun("t2"))?.taskId).toBe("t2")
    expect(await queryDayRun("missing")).toBeNull()
    expect((await queryDayRunsByTask("t1")).map((r) => r.id).sort()).toEqual([
      "t1",
      "t1::2026-07-25",
    ])
  })
})

describe("repeat ledgers", () => {
  it("supports CRUD and incremental point marking", async () => {
    expect(await queryRepeatLedger("t1")).toBeNull()

    await putRepeatLedger(makeLedger("t1", { "2026-07-20": "planned" }))
    await expectLiveMeta("repeatLedgers:t1")
    expect((await queryAllRepeatLedgers()).length).toBe(1)

    expect(await markRepeatPoint("t1", dk("2026-07-21"), "completed")).toBe(1)
    expect((await queryRepeatLedger("t1"))?.points).toEqual({
      "2026-07-20": "planned",
      "2026-07-21": "completed",
    })
    expect(await markRepeatPoint("missing", dk("2026-07-21"), "completed")).toBe(
      0
    )
    expect(await getMeta("repeatLedgers:missing")).toBeUndefined()

    await deleteRepeatLedger("t1")
    expect(await queryRepeatLedger("t1")).toBeNull()
    await expectTombstone("repeatLedgers:t1")
  })
})

describe("queryEntitySnapshot", () => {
  it("returns all eight entity tables as id-keyed records with revived values", async () => {
    await putGoal(makeGoal("g1"))
    await putTask(makeTask("t1", { goalId: "g1" }))
    await putDep(makeDep("d1", "g1"))
    await db.goalTriggerStates.put({
      goalId: "g1",
      lastTriggeredDateKey: dk("2026-07-25"),
    })
    await db.goalTriggerStates.put({ goalId: "g2" })
    await db.taskTriggerStates.put({
      taskId: "t1",
      lastTriggeredDateKey: dk("2026-07-25"),
    })
    await db.taskTriggerStates.put({ taskId: "t2" })
    await putRepeatLedger(makeLedger("t1", { "2026-07-25": "completed" }))
    await putManualFocus("g1", dk("2026-07-26"))
    await putDismissedTask("t1", dk("2026-07-26"))

    const snapshot = await queryEntitySnapshot()
    expect(Object.keys(snapshot.goals)).toEqual(["g1"])
    expect(snapshot.goals["g1"]?.createdAt).toBeInstanceOf(Date)
    expect(Object.keys(snapshot.tasks)).toEqual(["t1"])
    expect(Object.keys(snapshot.deps)).toEqual(["d1"])
    expect(snapshot.goalTriggerStates["g1"]?.lastTriggeredDateKey).toBe(
      "2026-07-25"
    )
    expect(
      snapshot.goalTriggerStates["g2"]?.lastTriggeredDateKey
    ).toBeUndefined()
    expect(snapshot.taskTriggerStates["t1"]?.lastTriggeredDateKey).toBe(
      "2026-07-25"
    )
    expect(
      snapshot.taskTriggerStates["t2"]?.lastTriggeredDateKey
    ).toBeUndefined()
    expect(snapshot.repeatLedgers["t1"]?.points[dk("2026-07-25")]).toBe(
      "completed"
    )
    expect(snapshot.manualFocuses["g1"]?.dateKey).toBe("2026-07-26")
    expect(snapshot.dismissedTasks["t1"]?.dateKey).toBe("2026-07-26")
  })
})
