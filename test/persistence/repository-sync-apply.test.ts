import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it } from "vitest"

import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import { db, type AppMetaRow, type SyncReadCacheRow } from "@/persistence/db"
import {
  applyRemoteSnapshot,
  clearSyncReadCache,
  gcTombstones,
  putGoal,
  queryAllRecordMeta,
  querySyncReadCache,
  replaceSyncReadCache,
  type EntitySnapshot,
} from "@/persistence/repository"
import type { DeviceSnapshot, RecordMetaMap } from "@/services/sync/types"
import {
  dk,
  makeActivity,
  makeGoal,
  makeRun,
  makeTag,
  makeTask,
  resetDb,
} from "./helpers"

beforeEach(async () => {
  await resetDb()
})

function emptyEntities(): EntitySnapshot {
  return {
    goals: {},
    tasks: {},
    deps: {},
    goalTriggerStates: {},
    taskTriggerStates: {},
    repeatLedgers: {},
    manualFocuses: {},
    dismissedTasks: {},
  }
}

function remoteData(partial: {
  entities?: Partial<EntitySnapshot>
  tags?: TagDefinition[]
  activities?: ActivityEntity[]
  dayRuns?: DayRunEntity[]
  appMeta?: AppMetaRow[]
  recordMeta: RecordMetaMap
}) {
  return {
    entities: { ...emptyEntities(), ...(partial.entities ?? {}) },
    tags: partial.tags ?? [],
    activities: partial.activities ?? [],
    dayRuns: partial.dayRuns ?? [],
    appMeta: partial.appMeta ?? [],
    recordMeta: partial.recordMeta,
  }
}

const live = (t: number) => ({ updatedAt: t, deletedAt: null })
const dead = (t: number) => ({ updatedAt: t, deletedAt: t })

async function seedMeta(
  key: string,
  meta: { updatedAt: number; deletedAt: number | null }
) {
  await db.recordMeta.put({ key, ...meta })
}

describe("queryAllRecordMeta", () => {
  it("returns the sidecar as a key-indexed map", async () => {
    await seedMeta("goals:g1", live(1000))
    await seedMeta("tasks:t1", dead(2000))

    expect(await queryAllRecordMeta()).toEqual({
      "goals:g1": { updatedAt: 1000, deletedAt: null },
      "tasks:t1": { updatedAt: 2000, deletedAt: 2000 },
    })
  })
})

describe("gcTombstones", () => {
  it("drops only tombstones older than the horizon and reports the count", async () => {
    const now = Date.now()
    const horizon = 1000 * 60 * 60
    await seedMeta("goals:old-dead", {
      updatedAt: now - horizon - 5000,
      deletedAt: now - horizon - 5000,
    })
    await seedMeta("goals:fresh-dead", dead(now - 5000))
    await seedMeta("goals:old-live", {
      updatedAt: now - horizon - 5000,
      deletedAt: null,
    })

    expect(await gcTombstones(horizon)).toBe(1)
    const keys = (await db.recordMeta.toArray()).map((r) => r.key).sort()
    expect(keys).toEqual(["goals:fresh-dead", "goals:old-live"])

    // Nothing left to collect.
    expect(await gcTombstones(horizon)).toBe(0)
  })
})

describe("applyRemoteSnapshot", () => {
  it("applies remote records that are newer than local and stores merged meta verbatim", async () => {
    await db.goals.put(makeGoal("g1", { title: "local title" }))
    await seedMeta("goals:g1", live(1000))

    await applyRemoteSnapshot(
      remoteData({
        entities: {
          goals: { g1: makeGoal("g1", { title: "remote title" }) },
          tasks: { t1: makeTask("t1") },
        },
        recordMeta: {
          "goals:g1": live(2000),
          "tasks:t1": live(2000),
        },
      })
    )

    expect((await db.goals.get("g1"))?.title).toBe("remote title")
    expect(await db.tasks.get("t1")).toBeDefined()
    // Meta stored verbatim, never re-stamped.
    expect(await db.recordMeta.get("goals:g1")).toEqual({
      key: "goals:g1",
      updatedAt: 2000,
      deletedAt: null,
    })
    expect(await db.recordMeta.get("tasks:t1")).toEqual({
      key: "tasks:t1",
      updatedAt: 2000,
      deletedAt: null,
    })
  })

  it("keeps local records whose meta is strictly newer than the merged meta", async () => {
    await db.goals.put(makeGoal("g1", { title: "tapped mid-sync" }))
    await seedMeta("goals:g1", live(5000))

    await applyRemoteSnapshot(
      remoteData({
        entities: { goals: { g1: makeGoal("g1", { title: "stale remote" }) } },
        recordMeta: { "goals:g1": live(1000) },
      })
    )

    expect((await db.goals.get("g1"))?.title).toBe("tapped mid-sync")
    expect((await db.recordMeta.get("goals:g1"))?.updatedAt).toBe(5000)
  })

  it("deletes locally when the merged meta carries a tombstone (merged wins ties)", async () => {
    await db.goals.put(makeGoal("g-dead"))
    await seedMeta("goals:g-dead", live(1000))
    await db.tasks.put(makeTask("t-tie"))
    await seedMeta("tasks:t-tie", live(3000))

    await applyRemoteSnapshot(
      remoteData({
        recordMeta: {
          "goals:g-dead": dead(2000),
          // Tie on updatedAt: merged tombstone still wins.
          "tasks:t-tie": dead(3000),
        },
      })
    )

    expect(await db.goals.get("g-dead")).toBeUndefined()
    expect(await db.tasks.get("t-tie")).toBeUndefined()
    expect(await db.recordMeta.get("goals:g-dead")).toEqual({
      key: "goals:g-dead",
      updatedAt: 2000,
      deletedAt: 2000,
    })
    expect(await db.recordMeta.get("tasks:t-tie")).toEqual({
      key: "tasks:t-tie",
      updatedAt: 3000,
      deletedAt: 3000,
    })
  })

  it("never touches records absent from the merged meta (created mid-sync)", async () => {
    await putGoal(makeGoal("g-local-only"))

    await applyRemoteSnapshot(remoteData({ recordMeta: {} }))

    expect(await db.goals.get("g-local-only")).toBeDefined()
    expect(await db.recordMeta.get("goals:g-local-only")).toBeDefined()
  })

  it("writes every synced table kind from the remote payload", async () => {
    const run = makeRun("t1", "t1", "2026-07-26")
    await applyRemoteSnapshot(
      remoteData({
        entities: {
          goals: { g1: makeGoal("g1") },
          deps: {
            d1: { id: "d1", belongTo: "g1", tree: [] },
          },
          goalTriggerStates: {
            g1: { goalId: "g1", lastTriggeredDateKey: dk("2026-07-26") },
          },
          taskTriggerStates: {
            t1: { taskId: "t1", lastTriggeredDateKey: dk("2026-07-26") },
          },
          repeatLedgers: {
            t1: { taskId: "t1", points: {} },
          },
          manualFocuses: {
            g1: { goalId: "g1", dateKey: dk("2026-07-26"), source: "manual" },
          },
          dismissedTasks: {
            t1: { taskId: "t1", dateKey: dk("2026-07-26") },
          },
        },
        tags: [makeTag("tag1", "Remote")],
        activities: [makeActivity("a1", "t1")],
        dayRuns: [run],
        appMeta: [{ key: "lastFullReplanDateKey", value: "2026-07-26" }],
        recordMeta: {
          "goals:g1": live(100),
          "deps:d1": live(100),
          "goalTriggerStates:g1": live(100),
          "taskTriggerStates:t1": live(100),
          "repeatLedgers:t1": live(100),
          "manualFocuses:g1": live(100),
          "dismissedTasks:t1": live(100),
          "tags:tag1": live(100),
          "activities:a1": live(100),
          "dayRuns:t1": live(100),
          "appMeta:lastFullReplanDateKey": live(100),
        },
      })
    )

    expect(await db.goals.get("g1")).toBeDefined()
    expect(await db.deps.get("d1")).toBeDefined()
    expect(await db.goalTriggerStates.get("g1")).toBeDefined()
    expect(await db.taskTriggerStates.get("t1")).toBeDefined()
    expect(await db.repeatLedgers.get("t1")).toBeDefined()
    expect(await db.manualFocuses.get("g1")).toBeDefined()
    expect(await db.dismissedTasks.get("t1")).toBeDefined()
    expect(await db.tags.get("tag1")).toBeDefined()
    expect(await db.activities.get("a1")).toBeDefined()
    expect(await db.dayRuns.get("t1")).toEqual(run)
    expect(await db.appMeta.get("lastFullReplanDateKey")).toEqual({
      key: "lastFullReplanDateKey",
      value: "2026-07-26",
    })
    expect(await db.recordMeta.count()).toBe(11)
  })
})

describe("sync read cache", () => {
  function makeSnapshot(deviceId: string): DeviceSnapshot {
    return {
      schemaVersion: 2,
      deviceId,
      syncedAt: "2026-07-26T00:00:00.000Z",
      contentHash: `hash-${deviceId}`,
      data: {
        entities: emptyEntities(),
        tags: [],
        activities: [],
        dayRuns: [],
        appMeta: [],
      },
      recordMeta: {},
    }
  }

  function makeRow(
    fileId: string,
    providerKind: string,
    changeToken?: string
  ): SyncReadCacheRow {
    return {
      fileId,
      providerKind,
      ...(changeToken !== undefined && { changeToken }),
      snapshot: makeSnapshot(`device-${fileId}`),
    }
  }

  it("replaceSyncReadCache replaces one provider's rows without touching others", async () => {
    await replaceSyncReadCache("google-drive", [
      makeRow("f1", "google-drive", "md5-1"),
      makeRow("f2", "google-drive", "md5-2"),
    ])
    await replaceSyncReadCache("onedrive", [makeRow("f3", "onedrive", "etag")])

    expect((await querySyncReadCache("google-drive")).length).toBe(2)
    expect((await querySyncReadCache("onedrive")).length).toBe(1)

    await replaceSyncReadCache("google-drive", [
      makeRow("f9", "google-drive", "md5-9"),
    ])
    const drive = await querySyncReadCache("google-drive")
    expect(drive.map((r) => r.fileId)).toEqual(["f9"])
    expect(drive[0]?.changeToken).toBe("md5-9")
    expect(drive[0]?.snapshot.deviceId).toBe("device-f9")
    expect((await querySyncReadCache("onedrive")).length).toBe(1)

    // Replacing with an empty list clears the provider.
    await replaceSyncReadCache("google-drive", [])
    expect((await querySyncReadCache("google-drive")).length).toBe(0)
    expect((await querySyncReadCache("onedrive")).length).toBe(1)
  })

  it("clearSyncReadCache deletes only the given provider's rows", async () => {
    await replaceSyncReadCache("google-drive", [
      makeRow("f1", "google-drive"),
    ])
    await replaceSyncReadCache("onedrive", [makeRow("f2", "onedrive")])

    await clearSyncReadCache("google-drive")
    expect((await querySyncReadCache("google-drive")).length).toBe(0)
    expect((await querySyncReadCache("onedrive")).length).toBe(1)
  })
})
