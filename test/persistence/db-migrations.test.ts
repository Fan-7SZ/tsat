import "fake-indexeddb/auto"

import Dexie from "dexie"
import { describe, expect, it, vi } from "vitest"

import { db, prepareTrackDb } from "@/persistence/db"
import {
  setNotifyHandler,
  withApplyingRemote,
} from "@/services/sync/sync-broadcast"

// Mirrors DB_STORES_V1 in src/persistence/db.ts (not exported there).
const V1_STORES = {
  goals: "id, tagId, dueAt",
  tasks: "id, goalId, dueAt",
  deps: "id, belongTo",
  activities:
    "id, kind, taskId, goalId, recordedAt, recordedDateKey, [taskId+recordedAt], [goalId+recordedAt], [kind+plannedForDate]",
  tags: "id, kind, name",
  goalTriggerStates: "goalId",
  taskTriggerStates: "taskId",
  repeatLedgers: "taskId",
}

describe("TrackDB migrations", () => {
  it("upgrades a v1 database: hoists trigger.allowCrossDay and backfills recordMeta", async () => {
    await db.delete()

    const legacy = new Dexie("track-db")
    legacy.version(1).stores(V1_STORES)
    await legacy.open()

    const goalCreated = new Date("2026-01-05T08:00:00")
    const activityRecorded = new Date("2026-03-01T10:00:00")
    await legacy.table("goals").bulkPut([
      { id: "g-date", title: "g", createdAt: goalCreated },
      { id: "g-string", title: "g", createdAt: "2026-02-03T00:00:00" },
      { id: "g-none", title: "g" },
    ])
    await legacy.table("tasks").bulkPut([
      {
        id: "t-legacy",
        title: "t",
        createdAt: 1700000000000,
        total: 1,
        completedCount: 0,
        trigger: { rule: { mode: "daily", interval: 1 }, allowCrossDay: true },
      },
      {
        id: "t-garbage",
        title: "t",
        createdAt: "not-a-date",
        total: 1,
        completedCount: 0,
      },
    ])
    await legacy.table("deps").put({ id: "d1", belongTo: "g-date", tree: [] })
    await legacy.table("tags").put({
      id: "tag1",
      name: "n",
      color: "#ffffff",
      iconKey: "Tag",
      kind: "custom",
    })
    await legacy.table("activities").put({
      id: "a1",
      kind: "task-done",
      taskId: "t-legacy",
      runtimeId: "t-legacy",
      recordedDateKey: "2026-03-01",
      recordedAt: activityRecorded,
      taskTitleSnapshot: "t",
    })
    await legacy
      .table("goalTriggerStates")
      .put({ goalId: "g-date", lastTriggeredDateKey: "2026-03-01" })
    await legacy
      .table("taskTriggerStates")
      .put({ taskId: "t-legacy", lastTriggeredDateKey: "2026-03-01" })
    await legacy.table("repeatLedgers").put({ taskId: "t-garbage", points: {} })
    legacy.close()

    const before = Date.now()
    await db.open()
    const after = Date.now()

    // v2: allowCrossDay moved from the trigger config to the task level.
    const migrated = await db.tasks.get("t-legacy")
    expect(migrated?.allowCrossDay).toBe(true)
    expect(migrated?.trigger).toBeDefined()
    expect(
      migrated?.trigger && "allowCrossDay" in migrated.trigger
    ).toBe(false)
    const untouched = await db.tasks.get("t-garbage")
    expect(untouched?.allowCrossDay).toBeUndefined()

    // v3: one recordMeta row per pre-existing record.
    const rows = await db.recordMeta.toArray()
    const meta = new Map(rows.map((r) => [r.key, r]))
    expect(meta.size).toBe(11)
    for (const row of rows) expect(row.deletedAt).toBeNull()

    const inWindow = (value: number | undefined) => {
      expect(value).toBeGreaterThanOrEqual(before)
      expect(value).toBeLessThanOrEqual(after)
    }
    expect(meta.get("goals:g-date")?.updatedAt).toBe(goalCreated.getTime())
    expect(meta.get("goals:g-string")?.updatedAt).toBe(
      new Date("2026-02-03T00:00:00").getTime()
    )
    inWindow(meta.get("goals:g-none")?.updatedAt)
    expect(meta.get("tasks:t-legacy")?.updatedAt).toBe(1700000000000)
    inWindow(meta.get("tasks:t-garbage")?.updatedAt)
    inWindow(meta.get("deps:d1")?.updatedAt)
    inWindow(meta.get("tags:tag1")?.updatedAt)
    expect(meta.get("activities:a1")?.updatedAt).toBe(
      activityRecorded.getTime()
    )
    inWindow(meta.get("goalTriggerStates:g-date")?.updatedAt)
    inWindow(meta.get("taskTriggerStates:t-legacy")?.updatedAt)
    inWindow(meta.get("repeatLedgers:t-garbage")?.updatedAt)

    // v4-v6 tables exist and are empty.
    expect(await db.syncReadCache.count()).toBe(0)
    expect(await db.dayRuns.count()).toBe(0)
    expect(await db.appMeta.count()).toBe(0)
  })

  it("prepareTrackDb opens once and installs change triggers that skip inbound applies", async () => {
    const first = prepareTrackDb()
    const second = prepareTrackDb()
    expect(second).toBe(first)
    await first

    const handler = vi.fn()
    setNotifyHandler(handler)
    try {
      await db.goals.put({
        id: "hook-goal",
        title: "hook",
        createdAt: new Date("2026-07-01T00:00:00"),
      })
      expect(handler).toHaveBeenCalledTimes(1)

      await db.goals.update("hook-goal", { title: "renamed" })
      expect(handler).toHaveBeenCalledTimes(2)

      await db.goals.delete("hook-goal")
      expect(handler).toHaveBeenCalledTimes(3)

      await withApplyingRemote(async () => {
        await db.tasks.put({
          id: "remote-task",
          title: "remote",
          createdAt: new Date("2026-07-01T00:00:00"),
          total: 1,
          completedCount: 0,
        })
      })
      expect(handler).toHaveBeenCalledTimes(3)
    } finally {
      setNotifyHandler(null)
    }
  })
})
