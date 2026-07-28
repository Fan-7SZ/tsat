import { describe, expect, it } from "vitest"

import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  ActivityID,
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { buildApplyPlan } from "@/services/sync/apply-plan"
import type { SyncRecordData } from "@/services/sync/merge-engine"

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
// Real activity ids contain "::" — exercises first-colon key parsing.
function activity(id: string, taskId: string): ActivityEntity {
  return {
    id: id as ActivityID,
    kind: "task-done",
    taskId: taskId as TaskID,
    runtimeId: "rt1" as TaskRuntimeID,
    recordedDateKey: "2026-01-01" as LocalDateKey,
    recordedAt: new Date("2026-01-01"),
    taskTitleSnapshot: taskId,
  }
}
function ledger(taskId: string): RepeatLedgerEntity {
  return {
    taskId: taskId as TaskID,
    points: { ["2026-01-01" as LocalDateKey]: "completed" },
  }
}

function data(
  partial: {
    entities?: Partial<SyncRecordData["entities"]>
    tags?: SyncRecordData["tags"]
    activities?: SyncRecordData["activities"]
    dayRuns?: SyncRecordData["dayRuns"]
    appMeta?: SyncRecordData["appMeta"]
  } = {}
): SyncRecordData {
  return {
    dayRuns: partial.dayRuns ?? [],
    appMeta: partial.appMeta ?? [],
    entities: {
      goals: {},
      tasks: {},
      deps: {},
      goalTriggerStates: {},
      taskTriggerStates: {},
      repeatLedgers: {},
      manualFocuses: {},
      dismissedTasks: {},
      ...(partial.entities ?? {}),
    },
    tags: partial.tags ?? [],
    activities: partial.activities ?? [],
  }
}

const live = (t: number) => ({ updatedAt: t, deletedAt: null })
const dead = (t: number) => ({ updatedAt: t, deletedAt: t })

describe("buildApplyPlan", () => {
  it("applies merged records that are newer than local", () => {
    const g = goal("g1", "remote")
    const plan = buildApplyPlan(
      data({ entities: { goals: { g1: g } } }),
      { "goals:g1": live(2) },
      { "goals:g1": live(1) }
    )
    expect(plan.puts.goals).toEqual([g])
    expect(plan.metaPuts).toEqual([
      { key: "goals:g1", updatedAt: 2, deletedAt: null },
    ])
  })

  it("keeps a local record written after the snapshot (local newer)", () => {
    // The sync-window race: merged carries the stale pre-tap state (t=1),
    // local was tapped mid-flight (t=5) — nothing may be touched.
    const plan = buildApplyPlan(
      data({
        entities: {
          tasks: { t1: task("t1") },
        },
      }),
      { "tasks:t1": live(1) },
      { "tasks:t1": live(5) }
    )
    expect(plan.puts.tasks).toEqual([])
    expect(plan.deletes.tasks).toEqual([])
    expect(plan.metaPuts).toEqual([])
  })

  it("merged wins ties (matching merge-engine tombstone-at-tie semantics)", () => {
    const plan = buildApplyPlan(data(), { "goals:g1": dead(3) }, {
      "goals:g1": live(3),
    })
    expect(plan.deletes.goals).toEqual(["g1"])
    expect(plan.metaPuts).toEqual([
      { key: "goals:g1", updatedAt: 3, deletedAt: 3 },
    ])
  })

  it("deletes tombstoned records and stores the tombstone meta verbatim", () => {
    const plan = buildApplyPlan(data(), { "tasks:t1": dead(9) }, {
      "tasks:t1": live(4),
    })
    expect(plan.deletes.tasks).toEqual(["t1"])
    expect(plan.metaPuts).toEqual([
      { key: "tasks:t1", updatedAt: 9, deletedAt: 9 },
    ])
  })

  it("never touches local-only keys (records created mid-sync)", () => {
    const plan = buildApplyPlan(data(), {}, { "activities:act::new": live(7) })
    expect(plan.puts.activities).toEqual([])
    expect(plan.deletes.activities).toEqual([])
    expect(plan.metaPuts).toEqual([])
  })

  it("applies records with no local meta at all (fresh remote record)", () => {
    const g = goal("g1")
    const plan = buildApplyPlan(
      data({ entities: { goals: { g1: g } } }),
      { "goals:g1": live(1) },
      {}
    )
    expect(plan.puts.goals).toEqual([g])
  })

  it("skips live meta whose record is missing (defensive)", () => {
    const plan = buildApplyPlan(data(), { "goals:ghost": live(2) }, {})
    expect(plan.puts.goals).toEqual([])
    expect(plan.metaPuts).toEqual([])
  })

  it("ignores keys of unknown tables", () => {
    const plan = buildApplyPlan(data(), { "nonsense:x": live(2) }, {})
    expect(plan.metaPuts).toEqual([])
  })

  it("parses ids containing colons (activities) on the first separator", () => {
    const act = activity("act::task-done::manual::t1::uuid", "t1")
    const plan = buildApplyPlan(
      data({ activities: [act] }),
      { [`activities:${act.id}`]: live(2) },
      {}
    )
    expect(plan.puts.activities).toEqual([act])
    expect(plan.metaPuts[0].key).toBe(`activities:${act.id}`)
  })

  it("routes records to their tables across entity kinds", () => {
    const g = goal("g1")
    const t = task("t1", "g1")
    const act = activity("act::task-done::x", "t1")
    const led = ledger("t1")
    const plan = buildApplyPlan(
      data({
        entities: {
          goals: { g1: g },
          tasks: { t1: t },
          repeatLedgers: { t1: led },
        },
        activities: [act],
      }),
      {
        "goals:g1": live(1),
        "tasks:t1": live(1),
        [`activities:${act.id}`]: live(1),
        "repeatLedgers:t1": live(1),
      },
      {}
    )
    expect(plan.puts.goals).toEqual([g])
    expect(plan.puts.tasks).toEqual([t])
    expect(plan.puts.activities).toEqual([act])
    expect(plan.puts.repeatLedgers).toEqual([led])
    expect(plan.metaPuts).toHaveLength(4)
  })
})
