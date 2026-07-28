import { describe, expect, it } from "vitest"

import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { DismissedTaskRecord } from "@/domain/entities/IntentRecord"
import type { ActivityID, TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { mergeDeviceSnapshots } from "@/services/sync/merge-engine"
import type { DeviceSnapshot, RecordMetaMap, SyncData } from "@/services/sync/types"
import { selectTodayDismissedTaskIds } from "@/utils/dismissed-tasks"

// Two devices cross the day boundary at different moments: the sweep is
// device-local (runtimeValidUntil), while the rows it touches are synced.
// These scenarios pin the convergence story after PR4: intent tables are
// additive at the boundary (no tombstone races), run-row conflicts resolve by
// LWW with the completion FACTS (activities / ledger) surviving on their own
// meta, and "merge → partial replan" makes the row set consistent again.

const day = (key: string) => key as LocalDateKey
const taskId = "t1" as TaskID

// Every scenario shares one task both devices know about (referential
// integrity repair drops rows whose parent task is missing).
const sharedTask: TaskGroupEntity = {
  id: taskId,
  title: "Task",
  createdAt: new Date("2026-07-01T09:00:00"),
  total: 1,
  completedCount: 0,
}

function run(
  id: string,
  dateKey: string,
  patch: Partial<DayRunEntity> = {}
): DayRunEntity {
  return {
    id,
    taskId,
    arrangementStatus: "todo",
    source: "default",
    dateKey: day(dateKey),
    ...patch,
  } as DayRunEntity
}

function activity(id: string, dateKey: string): ActivityEntity {
  return {
    id: id as ActivityID,
    kind: "task-done",
    taskId,
    runtimeId: "t1" as never,
    recordedDateKey: day(dateKey),
    recordedAt: new Date(`${dateKey}T20:00:00`),
    taskTitleSnapshot: "Task",
  }
}

function dev(opts: {
  deviceId: string
  dayRuns?: DayRunEntity[]
  activities?: ActivityEntity[]
  dismissedTasks?: DismissedTaskRecord[]
  meta: RecordMetaMap
}): DeviceSnapshot {
  return {
    schemaVersion: 1,
    deviceId: opts.deviceId,
    syncedAt: "2026-07-26T00:00:00.000Z",
    contentHash: "",
    data: {
      dayRuns: opts.dayRuns ?? [],
      entities: {
        goals: {},
        tasks: { [taskId]: sharedTask },
        deps: {},
        goalTriggerStates: {},
        taskTriggerStates: {},
        repeatLedgers: {},
        manualFocuses: {},
        dismissedTasks: Object.fromEntries(
          (opts.dismissedTasks ?? []).map((d) => [d.taskId, d])
        ),
      },
      tags: [],
      activities: opts.activities ?? [],
      appMeta: [] as SyncData["appMeta"],
    },
    recordMeta: { "tasks:t1": { updatedAt: 1, deletedAt: null }, ...opts.meta },
  }
}

const live = (t: number) => ({ updatedAt: t, deletedAt: null })
const dead = (t: number) => ({ updatedAt: t, deletedAt: t })

describe("cross-day sweep vs. late writes (dual-device convergence)", () => {
  it("scenario 1a: B's later completion outlives A's earlier sweep tombstone", () => {
    // A swept at t=2 (tombstoned yesterday's run); B, still on yesterday,
    // completed the run at t=3 and wrote its activity.
    const a = dev({ deviceId: "a", meta: { "dayRuns:t1": dead(2) } })
    const b = dev({
      deviceId: "b",
      dayRuns: [run("t1", "2026-07-25", { arrangementStatus: "done" })],
      activities: [activity("act::task-done::t1", "2026-07-25")],
      meta: { "dayRuns:t1": live(3), "activities:act::task-done::t1": live(3) },
    })

    const { data } = mergeDeviceSnapshots([a, b])

    // The done row wins by LWW. Its dateKey is yesterday's, so today-scoped
    // readers never show it; the next sweep GCs it as a stale row.
    expect(data.dayRuns).toHaveLength(1)
    expect(data.dayRuns[0]).toMatchObject({
      arrangementStatus: "done",
      dateKey: "2026-07-25",
    })
    expect(data.activities).toHaveLength(1)
  })

  it("scenario 1b: when A's sweep is later, the row dies but the completion fact survives", () => {
    const a = dev({ deviceId: "a", meta: { "dayRuns:t1": dead(4) } })
    const b = dev({
      deviceId: "b",
      dayRuns: [run("t1", "2026-07-25", { arrangementStatus: "done" })],
      activities: [activity("act::task-done::t1", "2026-07-25")],
      meta: { "dayRuns:t1": live(3), "activities:act::task-done::t1": live(3) },
    })

    const { data } = mergeDeviceSnapshots([a, b])

    // The run row loses to the newer tombstone — acceptable, because the
    // activity carries its own meta and survives: completedCount (a projection
    // of activities/ledger, never of run rows) stays correct either way.
    expect(data.dayRuns).toHaveLength(0)
    expect(data.activities).toHaveLength(1)
  })

  it("scenario 2: a carry-over rewritten to today outlives the peer's tombstone", () => {
    // B carried its allowCrossDay inProgress run over (dateKey → today, t=5);
    // A's sweep had tombstoned the same id at t=4.
    const a = dev({ deviceId: "a", meta: { "dayRuns:t1": dead(4) } })
    const b = dev({
      deviceId: "b",
      dayRuns: [run("t1", "2026-07-26", { arrangementStatus: "inProgress" })],
      meta: { "dayRuns:t1": live(5) },
    })

    const { data } = mergeDeviceSnapshots([a, b])

    expect(data.dayRuns).toHaveLength(1)
    expect(data.dayRuns[0]).toMatchObject({
      arrangementStatus: "inProgress",
      dateKey: "2026-07-26",
    })
  })

  it("scenario 3: yesterday's dismissal survives the merge but is inert today", () => {
    // Post-PR4 the sweep writes NO dismissal tombstones, so B's yesterday
    // record merges through untouched — and the day-scoped filter is what
    // keeps it from meaning anything today.
    const a = dev({ deviceId: "a", meta: {} })
    const b = dev({
      deviceId: "b",
      dismissedTasks: [{ taskId, dateKey: day("2026-07-25") }],
      meta: { "dismissedTasks:t1": live(3) },
    })

    const { data } = mergeDeviceSnapshots([a, b])

    const records = Object.values(data.entities.dismissedTasks)
    expect(records).toHaveLength(1)
    expect(
      selectTodayDismissedTaskIds(records, day("2026-07-26")).size
    ).toBe(0)
    expect(selectTodayDismissedTaskIds(records, day("2026-07-25")).has(taskId)).toBe(
      true
    )
  })
})
