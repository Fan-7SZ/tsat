import { describe, expect, it } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { GoalTriggerState } from "@/domain/entities/TriggerEntity"
import type { TaskTriggerState } from "@/domain/entities/TaskTriggerEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {
  ManualFocusRecord,
  DismissedTaskRecord,
} from "@/domain/entities/IntentRecord"
import type {
  ActivityID,
  GoalID,
  TagID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { mergeDeviceSnapshots, recordsOfData } from "@/services/sync/merge-engine"
import type {
  DeviceSnapshot,
  RecordMetaMap,
  SyncData,
} from "@/services/sync/types"

// ── builders ────────────────────────────────────────────────
function goal(id: string, title = id): GoalEntity {
  return { id: id as GoalID, title, createdAt: new Date("2026-01-01") }
}
function task(id: string, goalId?: string): TaskGroupEntity {
  return {
    id: id as TaskID,
    title: id,
    createdAt: new Date("2026-01-01"),
    total: 1,
    completedCount: 0,
    ...(goalId ? { goalId: goalId as GoalID } : {}),
  }
}

function dev(opts: {
  deviceId: string
  syncedAt?: string
  goals?: GoalEntity[]
  tasks?: TaskGroupEntity[]
  deps?: DependencyEntity[]
  goalTriggerStates?: GoalTriggerState[]
  taskTriggerStates?: TaskTriggerState[]
  repeatLedgers?: RepeatLedgerEntity[]
  manualFocuses?: ManualFocusRecord[]
  dismissedTasks?: DismissedTaskRecord[]
  tags?: TagDefinition[]
  activities?: ActivityEntity[]
  dayRuns?: DayRunEntity[]
  appMeta?: SyncData["appMeta"]
  meta: RecordMetaMap
}): DeviceSnapshot {
  return {
    schemaVersion: 1,
    deviceId: opts.deviceId,
    syncedAt: opts.syncedAt ?? "2026-01-01T00:00:00.000Z",
    contentHash: "",
    data: {
      dayRuns: opts.dayRuns ?? [],
      entities: {
        goals: Object.fromEntries((opts.goals ?? []).map((g) => [g.id, g])),
        tasks: Object.fromEntries((opts.tasks ?? []).map((t) => [t.id, t])),
        deps: Object.fromEntries((opts.deps ?? []).map((d) => [d.id, d])),
        goalTriggerStates: Object.fromEntries(
          (opts.goalTriggerStates ?? []).map((s) => [s.goalId, s])
        ),
        taskTriggerStates: Object.fromEntries(
          (opts.taskTriggerStates ?? []).map((s) => [s.taskId, s])
        ),
        repeatLedgers: Object.fromEntries(
          (opts.repeatLedgers ?? []).map((l) => [l.taskId, l])
        ),
        manualFocuses: Object.fromEntries(
          (opts.manualFocuses ?? []).map((m) => [m.goalId, m])
        ),
        dismissedTasks: Object.fromEntries(
          (opts.dismissedTasks ?? []).map((d) => [d.taskId, d])
        ),
      },
      tags: opts.tags ?? [],
      activities: opts.activities ?? [],
      appMeta: opts.appMeta ?? [],
    },
    recordMeta: opts.meta,
  }
}

const day = (key: string) => key as LocalDateKey
const manualFocus = (goalId: string, dateKey = "2026-01-01"): ManualFocusRecord => ({
  goalId: goalId as GoalID,
  dateKey: day(dateKey),
})
const dismissed = (taskId: string, dateKey = "2026-01-01"): DismissedTaskRecord => ({
  taskId: taskId as TaskID,
  dateKey: day(dateKey),
})

const live = (t: number) => ({ updatedAt: t, deletedAt: null })
const dead = (t: number) => ({ updatedAt: t, deletedAt: t })

describe("mergeDeviceSnapshots", () => {
  it("unions disjoint records", () => {
    const a = dev({ deviceId: "a", goals: [goal("g1")], meta: { "goals:g1": live(1) } })
    const b = dev({ deviceId: "b", goals: [goal("g2")], meta: { "goals:g2": live(1) } })
    const { data } = mergeDeviceSnapshots([a, b])
    expect(Object.keys(data.entities.goals).sort()).toEqual(["g1", "g2"])
  })

  it("last-write-wins by updatedAt", () => {
    const a = dev({ deviceId: "a", goals: [goal("g1", "A")], meta: { "goals:g1": live(1) } })
    const b = dev({ deviceId: "b", goals: [goal("g1", "B")], meta: { "goals:g1": live(2) } })
    const { data } = mergeDeviceSnapshots([a, b])
    expect(data.entities.goals.g1.title).toBe("B")
  })

  it("tombstone wins over older live", () => {
    const a = dev({ deviceId: "a", goals: [goal("g1")], meta: { "goals:g1": live(1) } })
    const b = dev({ deviceId: "b", meta: { "goals:g1": dead(2) } })
    const { data, recordMeta } = mergeDeviceSnapshots([a, b])
    expect(data.entities.goals.g1).toBeUndefined()
    expect(recordMeta["goals:g1"].deletedAt).toBe(2)
  })

  it("goal delete wins even against a newer live write", () => {
    const a = dev({ deviceId: "a", meta: { "goals:g1": dead(1) } })
    const b = dev({ deviceId: "b", goals: [goal("g1", "B")], meta: { "goals:g1": live(2) } })
    const { data, recordMeta } = mergeDeviceSnapshots([a, b])
    expect(data.entities.goals.g1).toBeUndefined()
    expect(recordMeta["goals:g1"]).toEqual({ updatedAt: 1, deletedAt: 1 })
  })

  it("task delete wins even against a newer live write (e.g. a trigger reset)", () => {
    // B fired a trigger after A deleted t1 — the automated re-stamp must not
    // resurrect the task.
    const a = dev({
      deviceId: "a",
      goals: [goal("g1")],
      meta: { "goals:g1": live(1), "tasks:t1": dead(2) },
    })
    const b = dev({
      deviceId: "b",
      goals: [goal("g1")],
      tasks: [task("t1", "g1")],
      meta: { "goals:g1": live(1), "tasks:t1": live(9) },
    })
    const { data, recordMeta } = mergeDeviceSnapshots([a, b])
    expect(data.entities.tasks.t1).toBeUndefined()
    expect(recordMeta["tasks:t1"]).toEqual({ updatedAt: 2, deletedAt: 2 })
  })

  it("keeps pure LWW for recreatable keys: re-focus after un-focus survives", () => {
    // manualFocuses reuses the goalId as key — un-focus (tombstone) then
    // focus again (newer live) must resurrect, unlike goals/tasks.
    const a = dev({
      deviceId: "a",
      goals: [goal("g1")],
      meta: { "goals:g1": live(1), "manualFocuses:g1": dead(2) },
    })
    const b = dev({
      deviceId: "b",
      goals: [goal("g1")],
      manualFocuses: [manualFocus("g1")],
      meta: { "goals:g1": live(1), "manualFocuses:g1": live(3) },
    })
    const { data } = mergeDeviceSnapshots([a, b])
    expect(data.entities.manualFocuses.g1?.goalId).toBe("g1")
  })

  it("repairs a task whose goal was deleted elsewhere", () => {
    // A keeps task t1 (alive, newer) under g1; B deleted g1.
    const a = dev({
      deviceId: "a",
      goals: [goal("g1")],
      tasks: [task("t1", "g1")],
      meta: { "goals:g1": live(1), "tasks:t1": live(5) },
    })
    const b = dev({ deviceId: "b", meta: { "goals:g1": dead(3) } })
    const { data, recordMeta } = mergeDeviceSnapshots([a, b])
    expect(data.entities.goals.g1).toBeUndefined()
    expect(data.entities.tasks.t1).toBeUndefined()
    // repaired tombstone is deterministic: deletedAt == prior updatedAt
    expect(recordMeta["tasks:t1"]).toEqual({ updatedAt: 5, deletedAt: 5 })
  })

  it("merges appMeta scalars per-record (LWW)", () => {
    const a = dev({
      deviceId: "a",
      appMeta: [{ key: "lastFullReplanDateKey", value: "2026-01-01" }],
      meta: { "appMeta:lastFullReplanDateKey": { updatedAt: 100, deletedAt: null } },
    })
    const b = dev({
      deviceId: "b",
      appMeta: [{ key: "lastFullReplanDateKey", value: "2026-01-02" }],
      meta: { "appMeta:lastFullReplanDateKey": { updatedAt: 200, deletedAt: null } },
    })
    const { data } = mergeDeviceSnapshots([a, b])
    expect(data.appMeta).toEqual([
      { key: "lastFullReplanDateKey", value: "2026-01-02" },
    ])
  })

  it("merges manual focus / dismissed per-record (LWW + tombstone)", () => {
    // A focused g1 (older); B un-focused g1 (tombstone, newer) and focused g2.
    // A dismissed t1; unchanged on B.
    const a = dev({
      deviceId: "a",
      goals: [goal("g1"), goal("g2")],
      tasks: [task("t1", "g1")],
      manualFocuses: [manualFocus("g1")],
      dismissedTasks: [dismissed("t1")],
      meta: {
        "goals:g1": live(1),
        "goals:g2": live(1),
        "tasks:t1": live(1),
        "manualFocuses:g1": live(1),
        "dismissedTasks:t1": live(1),
      },
    })
    const b = dev({
      deviceId: "b",
      manualFocuses: [manualFocus("g2")],
      meta: {
        "manualFocuses:g1": dead(2),
        "manualFocuses:g2": live(2),
      },
    })
    const { data } = mergeDeviceSnapshots([a, b])
    expect(data.entities.manualFocuses.g1).toBeUndefined() // un-focus won
    expect(data.entities.manualFocuses.g2?.goalId).toBe("g2")
    expect(data.entities.dismissedTasks.t1?.taskId).toBe("t1")
  })

  it("tombstones intent records whose parent entity is gone", () => {
    // A has focus on g1 + dismiss of t1; B deleted g1.
    const a = dev({
      deviceId: "a",
      goals: [goal("g1")],
      tasks: [task("t1", "g1")],
      manualFocuses: [manualFocus("g1")],
      dismissedTasks: [dismissed("t1")],
      meta: {
        "goals:g1": live(1),
        "tasks:t1": live(1),
        "manualFocuses:g1": live(1),
        "dismissedTasks:t1": live(1),
      },
    })
    const b = dev({ deviceId: "b", meta: { "goals:g1": dead(3) } })
    const { data } = mergeDeviceSnapshots([a, b])
    expect(data.entities.manualFocuses.g1).toBeUndefined()
    expect(data.entities.dismissedTasks.t1).toBeUndefined()
  })

  it("is order-independent (deterministic)", () => {
    const a = dev({ deviceId: "a", goals: [goal("g1", "A")], meta: { "goals:g1": live(1) } })
    const b = dev({ deviceId: "b", goals: [goal("g1", "B"), goal("g2")], meta: { "goals:g1": live(2), "goals:g2": live(1) } })
    const c = dev({ deviceId: "c", meta: { "goals:g2": dead(3) } })
    const r1 = mergeDeviceSnapshots([a, b, c])
    const r2 = mergeDeviceSnapshots([c, a, b])
    // Semantically identical regardless of input order. (Byte-level determinism
    // for the content hash is achieved by canonical, sorted-key serialization in
    // the snapshot builder, not by the merge output's key order.)
    expect(r1).toEqual(r2)
  })

  it("breaks a live/live tie at the same updatedAt by larger deviceId", () => {
    const a = dev({ deviceId: "a", goals: [goal("g1", "A")], meta: { "goals:g1": live(5) } })
    const b = dev({ deviceId: "b", goals: [goal("g1", "B")], meta: { "goals:g1": live(5) } })
    expect(mergeDeviceSnapshots([a, b]).data.entities.goals.g1.title).toBe("B")
    expect(mergeDeviceSnapshots([b, a]).data.entities.goals.g1.title).toBe("B")
  })

  it("breaks a live/tombstone tie at the same updatedAt in favor of the tombstone", () => {
    const a = dev({ deviceId: "a", goals: [goal("g1")], meta: { "goals:g1": live(5) } })
    const b = dev({ deviceId: "b", meta: { "goals:g1": dead(5) } })
    const { data, recordMeta } = mergeDeviceSnapshots([a, b])
    expect(data.entities.goals.g1).toBeUndefined()
    expect(recordMeta["goals:g1"]).toEqual({ updatedAt: 5, deletedAt: 5 })
  })

  it("ignores a device entry with live meta but a missing record", () => {
    // a claims g1 is live at t=9 but ships no record; b has an older live copy.
    const a = dev({ deviceId: "a", meta: { "goals:g1": live(9) } })
    const b = dev({ deviceId: "b", goals: [goal("g1", "B")], meta: { "goals:g1": live(1) } })
    const { data } = mergeDeviceSnapshots([a, b])
    expect(data.entities.goals.g1?.title).toBe("B")
  })

  it("treats a record without meta as updatedAt=0, losing to any stamped write", () => {
    const a = dev({ deviceId: "a", goals: [goal("g1", "unstamped")], meta: {} })
    const b = dev({ deviceId: "b", goals: [goal("g1", "stamped")], meta: { "goals:g1": live(1) } })
    const { data, recordMeta } = mergeDeviceSnapshots([a, b])
    expect(data.entities.goals.g1.title).toBe("stamped")
    expect(recordMeta["goals:g1"]).toEqual({ updatedAt: 1, deletedAt: null })
  })

  it("merges every table kind through the switch (deps/tags/activities/states/ledgers/dayRuns)", () => {
    const g1 = goal("g1")
    const t1 = task("t1", "g1")
    const dep: DependencyEntity = {
      id: "dep-1",
      belongTo: "g1" as GoalID,
      tree: [{ data: "t1" as TaskID, title: "t1", parent: null, children: null }],
    }
    const tag: TagDefinition = {
      id: "tag-1" as TagID,
      name: "urgent",
      color: "#f00",
      iconKey: "Tag",
      kind: "custom",
    }
    const activity: ActivityEntity = {
      id: "act-1" as ActivityID,
      kind: "task-done",
      taskId: "t1" as TaskID,
      runtimeId: "t1" as TaskRuntimeID,
      recordedDateKey: day("2026-01-01"),
      recordedAt: new Date("2026-01-01T10:00:00"),
      taskTitleSnapshot: "t1",
    }
    const goalState: GoalTriggerState = {
      goalId: "g1" as GoalID,
      lastTriggeredDateKey: day("2026-01-01"),
    }
    const taskState: TaskTriggerState = {
      taskId: "t1" as TaskID,
      lastTriggeredDateKey: day("2026-01-01"),
    }
    const ledger: RepeatLedgerEntity = {
      taskId: "t1" as TaskID,
      points: { [day("2026-01-01")]: "planned" },
    }
    const run: DayRunEntity = {
      id: "t1" as TaskRuntimeID,
      taskId: "t1" as TaskID,
      arrangementStatus: "todo",
      source: "default",
      dateKey: day("2026-01-01"),
    }
    const a = dev({
      deviceId: "a",
      goals: [g1],
      tasks: [t1],
      deps: [dep],
      tags: [tag],
      activities: [activity],
      goalTriggerStates: [goalState],
      taskTriggerStates: [taskState],
      repeatLedgers: [ledger],
      dayRuns: [run],
      meta: {
        "goals:g1": live(1),
        "tasks:t1": live(1),
        "deps:dep-1": live(1),
        "tags:tag-1": live(1),
        "activities:act-1": live(1),
        "goalTriggerStates:g1": live(1),
        "taskTriggerStates:t1": live(1),
        "repeatLedgers:t1": live(1),
        "dayRuns:t1": live(1),
      },
    })
    const { data } = mergeDeviceSnapshots([a])
    expect(data.entities.deps["dep-1"]).toEqual(dep)
    expect(data.tags).toEqual([tag])
    expect(data.activities).toEqual([activity])
    expect(data.entities.goalTriggerStates.g1).toEqual(goalState)
    expect(data.entities.taskTriggerStates.t1).toEqual(taskState)
    expect(data.entities.repeatLedgers.t1).toEqual(ledger)
    expect(data.dayRuns).toEqual([run])
  })
})

describe("repairReferentialIntegrity (via mergeDeviceSnapshots)", () => {
  it("tombstones deps and goal-trigger-states whose goal is gone", () => {
    const dep: DependencyEntity = {
      id: "dep-1",
      belongTo: "g1" as GoalID,
      tree: [],
    }
    const a = dev({
      deviceId: "a",
      goals: [goal("g1")],
      deps: [dep],
      goalTriggerStates: [{ goalId: "g1" as GoalID }],
      meta: {
        "goals:g1": live(1),
        "deps:dep-1": live(4),
        "goalTriggerStates:g1": live(4),
      },
    })
    const b = dev({ deviceId: "b", meta: { "goals:g1": dead(3) } })
    const { data, recordMeta } = mergeDeviceSnapshots([a, b])
    expect(data.entities.deps["dep-1"]).toBeUndefined()
    expect(data.entities.goalTriggerStates.g1).toBeUndefined()
    expect(recordMeta["deps:dep-1"]).toEqual({ updatedAt: 4, deletedAt: 4 })
    expect(recordMeta["goalTriggerStates:g1"]).toEqual({
      updatedAt: 4,
      deletedAt: 4,
    })
  })

  it("tombstones ledgers, trigger states, activities and dayRuns whose task is gone", () => {
    const a = dev({
      deviceId: "a",
      goals: [goal("g1")],
      tasks: [task("t1", "g1")],
      repeatLedgers: [{ taskId: "t1" as TaskID, points: {} }],
      taskTriggerStates: [{ taskId: "t1" as TaskID }],
      activities: [
        {
          id: "act-1" as ActivityID,
          kind: "task-done",
          taskId: "t1" as TaskID,
          runtimeId: "t1" as TaskRuntimeID,
          recordedDateKey: day("2026-01-01"),
          recordedAt: new Date("2026-01-01T10:00:00"),
          taskTitleSnapshot: "t1",
        },
      ],
      dayRuns: [
        {
          id: "t1" as TaskRuntimeID,
          taskId: "t1" as TaskID,
          arrangementStatus: "todo",
          source: "default",
          dateKey: day("2026-01-01"),
        },
      ],
      meta: {
        "goals:g1": live(1),
        "tasks:t1": live(1),
        "repeatLedgers:t1": live(2),
        "taskTriggerStates:t1": live(2),
        "activities:act-1": live(2),
        "dayRuns:t1": live(2),
      },
    })
    const b = dev({ deviceId: "b", meta: { "tasks:t1": dead(5) } })
    const { data, recordMeta } = mergeDeviceSnapshots([a, b])
    expect(data.entities.repeatLedgers.t1).toBeUndefined()
    expect(data.entities.taskTriggerStates.t1).toBeUndefined()
    expect(data.activities).toEqual([])
    expect(data.dayRuns).toEqual([])
    expect(recordMeta["repeatLedgers:t1"]).toEqual({ updatedAt: 2, deletedAt: 2 })
    expect(recordMeta["activities:act-1"]).toEqual({ updatedAt: 2, deletedAt: 2 })
    expect(recordMeta["dayRuns:t1"]).toEqual({ updatedAt: 2, deletedAt: 2 })
  })

  it("keeps a goal-less task untouched by the goal repair", () => {
    const orphan = task("t1") // no goalId
    const a = dev({ deviceId: "a", tasks: [orphan], meta: { "tasks:t1": live(1) } })
    const { data } = mergeDeviceSnapshots([a])
    expect(data.entities.tasks.t1).toEqual(orphan)
  })
})

describe("recordsOfData", () => {
  it("handles snapshots with missing dayRuns/appMeta arrays", () => {
    const data = dev({ deviceId: "a", meta: {} }).data
    // Simulate an older snapshot shape without the optional arrays.
    delete (data as { dayRuns?: unknown }).dayRuns
    delete (data as { appMeta?: unknown }).appMeta
    expect(recordsOfData(data, "dayRuns").size).toBe(0)
    expect(recordsOfData(data, "appMeta").size).toBe(0)
  })

  it("keys appMeta rows by key and trigger states by owner id", () => {
    const data = dev({
      deviceId: "a",
      appMeta: [{ key: "k1", value: 1 }],
      goalTriggerStates: [{ goalId: "g1" as GoalID }],
      taskTriggerStates: [{ taskId: "t1" as TaskID }],
      meta: {},
    }).data
    expect([...recordsOfData(data, "appMeta").keys()]).toEqual(["k1"])
    expect([...recordsOfData(data, "goalTriggerStates").keys()]).toEqual(["g1"])
    expect([...recordsOfData(data, "taskTriggerStates").keys()]).toEqual(["t1"])
  })
})
