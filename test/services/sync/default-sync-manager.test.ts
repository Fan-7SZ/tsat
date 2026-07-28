import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { GoalID } from "@/domain/value-objects/types"
import type { EntitySnapshot } from "@/persistence/repository"
import type { SyncManagerDelegate } from "@/services/sync/sync-manager"
import type { SyncProvider } from "@/services/sync/sync-provider"
import type {
  SyncPanelErrorCode,
  SyncPanelStatus,
} from "@/services/sync/sync-panel-types"
import type {
  DeviceFileRef,
  DeviceSnapshot,
  OccupiedStatus,
  RecordMetaMap,
  SyncConnectionStatus,
  SyncProviderKind,
} from "@/services/sync/types"
import { DEVICE_SNAPSHOT_SCHEMA_VERSION } from "@/services/sync/types"
import { isInApplyRemote } from "@/services/sync/sync-broadcast"

const mocks = vi.hoisted(() => ({
  queryEntitySnapshot: vi.fn(),
  queryDayRuns: vi.fn(),
  queryAppMetaRows: vi.fn(),
  queryAllTags: vi.fn(),
  queryAllActivities: vi.fn(),
  queryAllRecordMeta: vi.fn(),
  gcTombstones: vi.fn(),
  gcStaleIntentRecords: vi.fn(),
  applyRemoteSnapshot: vi.fn(),
  querySyncReadCache: vi.fn(),
  replaceSyncReadCache: vi.fn(),
  clearSyncReadCache: vi.fn(),
  replan: vi.fn(),
}))

vi.mock("@/persistence/repository", () => ({
  queryEntitySnapshot: mocks.queryEntitySnapshot,
  queryDayRuns: mocks.queryDayRuns,
  queryAppMetaRows: mocks.queryAppMetaRows,
  queryAllTags: mocks.queryAllTags,
  queryAllActivities: mocks.queryAllActivities,
  queryAllRecordMeta: mocks.queryAllRecordMeta,
  gcTombstones: mocks.gcTombstones,
  gcStaleIntentRecords: mocks.gcStaleIntentRecords,
  applyRemoteSnapshot: mocks.applyRemoteSnapshot,
  querySyncReadCache: mocks.querySyncReadCache,
  replaceSyncReadCache: mocks.replaceSyncReadCache,
  clearSyncReadCache: mocks.clearSyncReadCache,
}))

vi.mock("@/store/app-store", () => ({
  useAppStore: { getState: () => ({ replan: mocks.replan }) },
}))

// device-id reads localStorage; give it a deterministic in-memory one so the
// manager always syncs as "device-local".
const localStore = new Map<string, string>()
vi.stubGlobal("localStorage", {
  getItem: (k: string) => localStore.get(k) ?? null,
  setItem: (k: string, v: string) => void localStore.set(k, v),
  removeItem: (k: string) => void localStore.delete(k),
  clear: () => localStore.clear(),
})

import { DefaultSyncManager } from "@/services/sync/default-sync-manager"

const DEVICE_ID = "device-local"
const TOMBSTONE_HORIZON_MS = 90 * 24 * 60 * 60 * 1000
const KIND: SyncProviderKind = "google-drive"

// ── builders (style borrowed from merge-engine.test.ts) ─────────────────────
const live = (t: number) => ({ updatedAt: t, deletedAt: null })

function goal(id: string, title = id): GoalEntity {
  return { id: id as GoalID, title, createdAt: new Date("2026-01-01T00:00:00.000Z") }
}

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

function entitiesWith(goals: GoalEntity[]): EntitySnapshot {
  return {
    ...emptyEntities(),
    goals: Object.fromEntries(goals.map((g) => [g.id, g])) as EntitySnapshot["goals"],
  }
}

/** Configure the mocked repository reads that feed buildLocalSnapshot. */
function setLocalData(opts: { goals?: GoalEntity[]; meta?: RecordMetaMap } = {}) {
  mocks.queryEntitySnapshot.mockResolvedValue(entitiesWith(opts.goals ?? []))
  mocks.queryAllTags.mockResolvedValue([])
  mocks.queryAllActivities.mockResolvedValue([])
  mocks.queryDayRuns.mockResolvedValue([])
  mocks.queryAppMetaRows.mockResolvedValue([])
  mocks.queryAllRecordMeta.mockResolvedValue(opts.meta ?? {})
}

function makeSnapshot(
  deviceId: string,
  opts: {
    goals?: GoalEntity[]
    meta?: RecordMetaMap
    syncedAt?: string
    schemaVersion?: number
  } = {}
): DeviceSnapshot {
  return {
    schemaVersion: opts.schemaVersion ?? DEVICE_SNAPSHOT_SCHEMA_VERSION,
    deviceId,
    syncedAt: opts.syncedAt ?? "2026-07-01T00:00:00.000Z",
    contentHash: "",
    data: {
      entities: entitiesWith(opts.goals ?? []),
      tags: [],
      activities: [],
      dayRuns: [],
      appMeta: [],
    },
    recordMeta: opts.meta ?? {},
  }
}

// ── in-memory SyncProvider fake ─────────────────────────────────────────────
class FakeProvider implements SyncProvider {
  readonly providerKind: SyncProviderKind = KIND
  files = new Map<string, { ref: DeviceFileRef; snapshot: DeviceSnapshot }>()
  connectionStatus: SyncConnectionStatus = "connected"
  occupied: OccupiedStatus = "available"
  listCalls = 0
  readCalls: string[] = []
  writes: DeviceSnapshot[] = []
  listError: Error | null = null
  readError: Error | null = null
  connectError: Error | null = null
  disconnectError: Error | null = null
  disconnectCalls = 0

  setRemoteFile(deviceId: string, snapshot: DeviceSnapshot, changeToken?: string) {
    const fileId = `file-${deviceId}`
    this.files.set(fileId, { ref: { deviceId, fileId, changeToken }, snapshot })
  }
  async connect(): Promise<void> {
    if (this.connectError) throw this.connectError
    this.connectionStatus = "connected"
  }
  async disconnect(): Promise<void> {
    this.disconnectCalls += 1
    if (this.disconnectError) throw this.disconnectError
    this.connectionStatus = "disconnected"
  }
  async listDeviceDataFiles(): Promise<DeviceFileRef[]> {
    this.listCalls += 1
    if (this.listError) throw this.listError
    return [...this.files.values()].map((f) => f.ref)
  }
  async readDeviceData(ref: DeviceFileRef): Promise<DeviceSnapshot | null> {
    this.readCalls.push(ref.fileId)
    if (this.readError) throw this.readError
    return this.files.get(ref.fileId)?.snapshot ?? null
  }
  async writeOwnDeviceData(snapshot: DeviceSnapshot): Promise<void> {
    this.writes.push(snapshot)
    this.setRemoteFile(snapshot.deviceId, snapshot, `tok-own-${this.writes.length}`)
  }
  async deleteAllDeviceData(): Promise<void> {
    this.files.clear()
  }
  getConnectionStatus(): SyncConnectionStatus {
    return this.connectionStatus
  }
  getOccupiedStatus(): OccupiedStatus {
    return this.occupied
  }
  setPanelStatusChangeHandler(): void {}
}

class WorkerFakeProvider extends FakeProvider {
  getPanelStatus(): SyncPanelStatus {
    return "authorized"
  }
  getLastErrorCode(): SyncPanelErrorCode | null {
    return "sync_unavailable"
  }
  async clearRemoteCredential(): Promise<void> {}
}

function makeDelegate() {
  return {
    onStart: vi.fn(async () => {}),
    onStop: vi.fn(async () => {}),
    onConnect: vi.fn(async () => {}),
    onSyncNow: vi.fn(async () => {}),
  }
}

/** Force the (normally impossible) provider-less state to exercise fallbacks. */
function nullifyProvider(m: DefaultSyncManager) {
  ;(m as unknown as { provider: SyncProvider | null }).provider = null
}

let provider: FakeProvider
let delegate: ReturnType<typeof makeDelegate>

function makeManager(
  hash: string | null = null,
  syncedAt: string | null = null,
  p: SyncProvider = provider,
  d: SyncManagerDelegate = delegate
) {
  return new DefaultSyncManager(p, d, hash, syncedAt)
}

function applyArg(callIndex = 0): {
  entities: EntitySnapshot
  recordMeta: RecordMetaMap
} {
  return mocks.applyRemoteSnapshot.mock.calls[callIndex][0]
}

beforeEach(() => {
  vi.clearAllMocks()
  localStore.clear()
  localStore.set("track-device-id", DEVICE_ID)
  provider = new FakeProvider()
  delegate = makeDelegate()
  setLocalData()
  mocks.queryAllRecordMeta.mockResolvedValue({})
  mocks.gcTombstones.mockResolvedValue(0)
  mocks.gcStaleIntentRecords.mockResolvedValue(0)
  mocks.applyRemoteSnapshot.mockResolvedValue(undefined)
  mocks.querySyncReadCache.mockResolvedValue([])
  mocks.replaceSyncReadCache.mockResolvedValue(undefined)
  mocks.clearSyncReadCache.mockResolvedValue(undefined)
  mocks.replan.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

// ── getters ─────────────────────────────────────────────────────────────────
describe("DefaultSyncManager getters", () => {
  it("exposes constructor-seeded state", () => {
    const m = makeManager("hash-0", "2026-07-20T00:00:00.000Z")
    expect(m.getStatus()).toBe("idle")
    expect(m.getProviderKind()).toBe(KIND)
    expect(m.getLastSyncedAt()).toBe("2026-07-20T00:00:00.000Z")
    expect(m.getLastKnownHashData()).toBe("hash-0")
  })

  it("delegates connection, occupied and provider access to the provider", () => {
    provider.connectionStatus = "connecting"
    provider.occupied = "occupied"
    const m = makeManager()
    expect(m.getConnectionStatus()).toBe("connecting")
    expect(m.getOccupiedStatus()).toBe("occupied")
    expect(m.getProvider()).toBe(provider)
  })

  it("reports unauthorized/no-error for a non-worker-backed provider", () => {
    const m = makeManager()
    expect(m.getPanelStatus()).toBe("unauthorized")
    expect(m.getLastErrorCode()).toBeNull()
  })

  it("proxies panel status and error code for a worker-backed provider", () => {
    const m = makeManager(null, null, new WorkerFakeProvider())
    expect(m.getPanelStatus()).toBe("authorized")
    expect(m.getLastErrorCode()).toBe("sync_unavailable")
  })

  it("falls back gracefully when no provider is configured", async () => {
    const m = makeManager()
    nullifyProvider(m)
    expect(m.getConnectionStatus()).toBe("disconnected")
    expect(m.getOccupiedStatus()).toBe("available")
    expect(m.getProvider()).toBeNull()
    // syncNow / connect / disconnect become no-ops.
    await m.syncNow()
    await m.connect()
    await m.disconnect()
    expect(provider.listCalls).toBe(0)
    expect(provider.disconnectCalls).toBe(0)
    expect(mocks.clearSyncReadCache).not.toHaveBeenCalled()
    expect(delegate.onConnect).not.toHaveBeenCalled()
    expect(m.getStatus()).toBe("idle")
  })
})

// ── syncNow ─────────────────────────────────────────────────────────────────
describe("syncNow", () => {
  it("runs the full pipeline: merge remote files, apply locally, write own file", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"))

    setLocalData({ goals: [goal("g1", "A")], meta: { "goals:g1": live(1) } })
    const snapB = makeSnapshot("device-b", {
      goals: [goal("g1", "B"), goal("g2")],
      meta: { "goals:g1": live(2), "goals:g2": live(1) },
    })
    provider.setRemoteFile("device-b", snapB, "tok-b")

    const m = makeManager()
    await m.syncNow()

    // Merged content applied locally under withApplyingRemote + replan.
    expect(mocks.applyRemoteSnapshot).toHaveBeenCalledTimes(1)
    const arg = applyArg()
    expect(arg.entities.goals["g1" as GoalID].title).toBe("B") // remote LWW win
    expect(arg.entities.goals["g2" as GoalID]).toBeDefined()
    expect(arg.recordMeta["goals:g1"]).toEqual({ updatedAt: 2, deletedAt: null })
    expect(mocks.replan).toHaveBeenCalledWith("partial")

    // Own device file written with the merged content.
    expect(provider.writes).toHaveLength(1)
    const own = provider.writes[0]
    expect(own.schemaVersion).toBe(DEVICE_SNAPSHOT_SCHEMA_VERSION)
    expect(own.deviceId).toBe(DEVICE_ID)
    expect(own.syncedAt).toBe("2026-07-26T12:00:00.000Z")
    expect(own.contentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(own.contentHash).toBe(m.getLastKnownHashData())
    expect(own.data.entities.goals["g1" as GoalID].title).toBe("B")
    expect(own.data.entities.goals["g2" as GoalID]).toBeDefined()

    // Bookkeeping: gc, delegate, timestamps, status.
    expect(mocks.gcTombstones).toHaveBeenCalledWith(TOMBSTONE_HORIZON_MS)
    expect(delegate.onSyncNow).toHaveBeenCalledTimes(1)
    expect(m.getLastSyncedAt()).toBe("2026-07-26T12:00:00.000Z")
    expect(m.getStatus()).toBe("idle")
  })

  it("applies the remote snapshot inside withApplyingRemote", async () => {
    let applyingDuringApply: boolean | null = null
    let applyingDuringReplan: boolean | null = null
    mocks.applyRemoteSnapshot.mockImplementation(async () => {
      applyingDuringApply = isInApplyRemote()
    })
    mocks.replan.mockImplementation(async () => {
      applyingDuringReplan = isInApplyRemote()
    })
    await makeManager().syncNow()
    expect(applyingDuringApply).toBe(true)
    expect(applyingDuringReplan).toBe(true)
    expect(isInApplyRemote()).toBe(false)
  })

  it("skips both apply and upload when the merged content is unchanged", async () => {
    setLocalData({ goals: [goal("g1")], meta: { "goals:g1": live(1) } })
    const m = makeManager()
    await m.syncNow()
    expect(mocks.applyRemoteSnapshot).toHaveBeenCalledTimes(1)
    expect(provider.writes).toHaveLength(1)

    await m.syncNow()
    // Unchanged hash + own file present remotely ⇒ nothing re-applied/re-written…
    expect(mocks.applyRemoteSnapshot).toHaveBeenCalledTimes(1)
    expect(provider.writes).toHaveLength(1)
    // …but the cycle still completes (timestamp + delegate).
    expect(delegate.onSyncNow).toHaveBeenCalledTimes(2)
    expect(m.getStatus()).toBe("idle")
  })

  it("re-writes the own file when it vanished remotely even if content is unchanged", async () => {
    setLocalData({ goals: [goal("g1")], meta: { "goals:g1": live(1) } })
    const m = makeManager()
    await m.syncNow()
    expect(provider.writes).toHaveLength(1)

    provider.files.delete(`file-${DEVICE_ID}`) // e.g. "clear archive" wiped it
    await m.syncNow()
    expect(provider.writes).toHaveLength(2)
    expect(provider.writes[1].contentHash).toBe(provider.writes[0].contentHash)
    expect(mocks.applyRemoteSnapshot).toHaveBeenCalledTimes(1) // apply still skipped
  })

  it("hashes canonically: key order and undefined fields do not change the hash", async () => {
    // Manager 1 syncs goal g1 written one way…
    setLocalData({ goals: [goal("g1", "same")], meta: { "goals:g1": live(1) } })
    const m1 = makeManager()
    await m1.syncNow()
    const hash = m1.getLastKnownHashData()
    expect(provider.writes).toHaveLength(1)

    // …manager 2 (same account) sees the same logical content with reordered
    // keys and an explicit undefined optional field.
    const reordered = {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      title: "same",
      notes: undefined,
      id: "g1" as GoalID,
    } as GoalEntity
    setLocalData({ goals: [reordered], meta: { "goals:g1": { deletedAt: null, updatedAt: 1 } } })
    mocks.applyRemoteSnapshot.mockClear()
    const m2 = makeManager(hash, "2026-07-26T00:00:00.000Z")
    await m2.syncNow()

    expect(m2.getLastKnownHashData()).toBe(hash)
    expect(provider.writes).toHaveLength(1) // upload skipped
    expect(mocks.applyRemoteSnapshot).not.toHaveBeenCalled() // apply skipped
  })

  it("is single-flight: a concurrent call returns without doing anything", async () => {
    const m = makeManager()
    let release: ((v: EntitySnapshot) => void) | undefined
    mocks.queryEntitySnapshot.mockImplementationOnce(
      () => new Promise<EntitySnapshot>((res) => (release = res))
    )
    const first = m.syncNow()
    expect(m.getStatus()).toBe("syncing")
    await m.syncNow() // returns immediately (single-flight guard)
    expect(provider.listCalls).toBe(0)

    // Wait until the first run is actually blocked on the local snapshot read
    // (it awaits cache hydration first), then let it finish.
    await vi.waitFor(() => {
      if (!release) throw new Error("snapshot read not reached yet")
    })
    release!(emptyEntities())
    await first
    expect(m.getStatus()).toBe("idle")
    expect(provider.listCalls).toBe(1)
    expect(delegate.onSyncNow).toHaveBeenCalledTimes(1)
  })

  it("skips a malformed remote file this cycle and retries the next", async () => {
    const snapB = makeSnapshot("device-b", {
      goals: [goal("g-b")],
      meta: { "goals:g-b": live(2) },
    })
    provider.setRemoteFile("device-b", snapB, "tok-b")
    provider.readError = new Error("bad json")

    const m = makeManager()
    await m.syncNow()
    expect(m.getStatus()).toBe("idle") // read failure is not a sync failure
    expect(applyArg().entities.goals["g-b" as GoalID]).toBeUndefined()

    provider.readError = null
    await m.syncNow()
    expect(provider.readCalls.filter((f) => f === "file-device-b")).toHaveLength(2)
    expect(applyArg(1).entities.goals["g-b" as GoalID]).toBeDefined()
  })

  it("ignores a remote snapshot with a foreign schema version and does not cache it", async () => {
    const snapB = makeSnapshot("device-b", {
      goals: [goal("g-b")],
      meta: { "goals:g-b": live(2) },
      schemaVersion: 1,
    })
    provider.setRemoteFile("device-b", snapB, "tok-b")

    await makeManager().syncNow()
    expect(applyArg().entities.goals["g-b" as GoalID]).toBeUndefined()
    const rows = mocks.replaceSyncReadCache.mock.calls.at(-1)![1] as { fileId: string }[]
    expect(rows.find((r) => r.fileId === "file-device-b")).toBeUndefined()
  })

  it("ignores a null readDeviceData result", async () => {
    provider.setRemoteFile("device-b", makeSnapshot("device-b"), "tok-b")
    provider.files.get("file-device-b")!.snapshot = null as unknown as DeviceSnapshot
    const m = makeManager()
    await m.syncNow()
    expect(m.getStatus()).toBe("idle")
    expect(provider.writes).toHaveLength(1)
  })

  it("excludes files abandoned for over 180 days from the merge but still caches them", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"))
    const abandoned = makeSnapshot("device-old", {
      goals: [goal("g-old")],
      meta: { "goals:g-old": live(9) },
      syncedAt: "2025-12-01T00:00:00.000Z", // > 180 days ago
    })
    const fresh = makeSnapshot("device-b", {
      goals: [goal("g-b")],
      meta: { "goals:g-b": live(2) },
      syncedAt: "2026-06-01T00:00:00.000Z",
    })
    provider.setRemoteFile("device-old", abandoned, "tok-old")
    provider.setRemoteFile("device-b", fresh, "tok-b")

    await makeManager().syncNow()
    const arg = applyArg()
    expect(arg.entities.goals["g-old" as GoalID]).toBeUndefined()
    expect(arg.entities.goals["g-b" as GoalID]).toBeDefined()
    // Still cached (skip re-download next time), just not merged.
    const rows = mocks.replaceSyncReadCache.mock.calls.at(-1)![1] as { fileId: string }[]
    expect(rows.map((r) => r.fileId).sort()).toEqual(["file-device-b", "file-device-old"])
  })

  it("treats an unparsable syncedAt as not abandoned", async () => {
    const snapB = makeSnapshot("device-b", {
      goals: [goal("g-b")],
      meta: { "goals:g-b": live(2) },
      syncedAt: "not-a-date",
    })
    provider.setRemoteFile("device-b", snapB, "tok-b")
    await makeManager().syncNow()
    expect(applyArg().entities.goals["g-b" as GoalID]).toBeDefined()
  })

  it("survives gcTombstones rejection", async () => {
    mocks.gcTombstones.mockRejectedValue(new Error("gc failed"))
    const m = makeManager()
    await m.syncNow()
    expect(m.getStatus()).toBe("idle")
  })

  it("enters error status when the provider listing fails, and recovers next run", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    provider.listError = new Error("network down")
    const m = makeManager()
    await m.syncNow()
    expect(m.getStatus()).toBe("error")
    expect(delegate.onSyncNow).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()

    provider.listError = null
    await m.syncNow() // "error" is not "syncing", so a new run may start
    expect(m.getStatus()).toBe("idle")
    expect(delegate.onSyncNow).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })

  it("enters error status when applying the merged snapshot fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.applyRemoteSnapshot.mockRejectedValue(new Error("dexie tx failed"))
    const m = makeManager()
    await m.syncNow()
    expect(m.getStatus()).toBe("error")
    expect(provider.writes).toHaveLength(0) // failed before the upload step
    errorSpy.mockRestore()
  })

  it("enters error status when the delegate's onSyncNow rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    delegate.onSyncNow.mockRejectedValue(new Error("delegate boom"))
    const m = makeManager()
    await m.syncNow()
    expect(m.getStatus()).toBe("error")
    errorSpy.mockRestore()
  })
})

// ── read cache ──────────────────────────────────────────────────────────────
describe("read cache", () => {
  it("reuses the cached snapshot when the change token matches (download-skip)", async () => {
    const snapB = makeSnapshot("device-b", {
      goals: [goal("g-b")],
      meta: { "goals:g-b": live(2) },
    })
    provider.setRemoteFile("device-b", snapB, "tok-1")
    setLocalData({ goals: [goal("g1")], meta: { "goals:g1": live(1) } })

    const m = makeManager()
    await m.syncNow()
    expect(provider.readCalls).toEqual(["file-device-b"])

    // Local change forces a new merge/apply; the remote file is unchanged.
    setLocalData({
      goals: [goal("g1"), goal("g2")],
      meta: { "goals:g1": live(1), "goals:g2": live(3) },
    })
    await m.syncNow()
    expect(provider.readCalls).toEqual(["file-device-b"]) // no re-download
    // Cached snapshot still participates in the merge.
    expect(applyArg(1).entities.goals["g-b" as GoalID]).toBeDefined()
    expect(applyArg(1).entities.goals["g2" as GoalID]).toBeDefined()
  })

  it("re-downloads when the change token changes", async () => {
    provider.setRemoteFile(
      "device-b",
      makeSnapshot("device-b", { goals: [goal("g-b", "v1")], meta: { "goals:g-b": live(2) } }),
      "tok-1"
    )
    const m = makeManager()
    await m.syncNow()

    provider.setRemoteFile(
      "device-b",
      makeSnapshot("device-b", { goals: [goal("g-b", "v2")], meta: { "goals:g-b": live(5) } }),
      "tok-2"
    )
    await m.syncNow()
    expect(provider.readCalls).toEqual(["file-device-b", "file-device-b"])
    expect(applyArg(1).entities.goals["g-b" as GoalID].title).toBe("v2")
  })

  it("always re-downloads a file listed without a change token", async () => {
    provider.setRemoteFile(
      "device-b",
      makeSnapshot("device-b", { goals: [goal("g-b")], meta: { "goals:g-b": live(2) } })
      // no changeToken
    )
    const m = makeManager()
    await m.syncNow()
    await m.syncNow()
    expect(provider.readCalls).toEqual(["file-device-b", "file-device-b"])
  })

  it("persists cache rows to Dexie after each sync", async () => {
    const snapB = makeSnapshot("device-b", {
      goals: [goal("g-b")],
      meta: { "goals:g-b": live(2) },
    })
    provider.setRemoteFile("device-b", snapB, "tok-b")
    await makeManager().syncNow()
    expect(mocks.replaceSyncReadCache).toHaveBeenCalledWith(KIND, [
      { fileId: "file-device-b", providerKind: KIND, changeToken: "tok-b", snapshot: snapB },
    ])
  })

  it("survives a failing cache mirror write", async () => {
    mocks.replaceSyncReadCache.mockRejectedValue(new Error("dexie down"))
    provider.setRemoteFile("device-b", makeSnapshot("device-b"), "tok-b")
    const m = makeManager()
    await m.syncNow()
    expect(m.getStatus()).toBe("idle")
  })

  it("hydrates from Dexie once, letting the first pull skip unchanged files", async () => {
    const snapB = makeSnapshot("device-b", {
      goals: [goal("g-b")],
      meta: { "goals:g-b": live(2) },
    })
    provider.setRemoteFile("device-b", snapB, "tok-b")
    mocks.querySyncReadCache.mockResolvedValue([
      { fileId: "file-device-b", providerKind: KIND, changeToken: "tok-b", snapshot: snapB },
    ])

    const m = makeManager()
    await m.syncNow()
    expect(provider.readCalls).toEqual([]) // Dexie cache hit on a cold session
    expect(applyArg().entities.goals["g-b" as GoalID]).toBeDefined()

    await m.syncNow()
    expect(mocks.querySyncReadCache).toHaveBeenCalledTimes(1) // hydrate only once
  })

  it("treats a failed hydration as a cold cache, not a failed sync", async () => {
    mocks.querySyncReadCache.mockRejectedValue(new Error("dexie broken"))
    provider.setRemoteFile("device-b", makeSnapshot("device-b"), "tok-b")
    const m = makeManager()
    await m.syncNow()
    expect(m.getStatus()).toBe("idle")
    expect(provider.readCalls).toEqual(["file-device-b"])
  })
})

// ── start / stop ────────────────────────────────────────────────────────────
describe("start / stop", () => {
  it("starts one interval timer that drives syncNow every minute", async () => {
    vi.useFakeTimers()
    const m = makeManager()
    const syncSpy = vi.spyOn(m, "syncNow").mockResolvedValue(undefined)

    await m.start()
    expect(delegate.onStart).toHaveBeenCalledTimes(1)
    await m.start() // idempotent: no second timer, no second onStart
    expect(delegate.onStart).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60_000)
    expect(syncSpy).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_000)
    expect(syncSpy).toHaveBeenCalledTimes(2)

    await m.stop()
    expect(delegate.onStop).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(120_000)
    expect(syncSpy).toHaveBeenCalledTimes(2) // timer cleared
  })

  it("stop without a running timer still notifies the delegate", async () => {
    const m = makeManager()
    await m.stop()
    expect(delegate.onStop).toHaveBeenCalledTimes(1)
  })

  it("works with a delegate that implements no callbacks", async () => {
    vi.useFakeTimers()
    const m = makeManager(null, null, provider, {})
    await m.start()
    await m.syncNow()
    await m.connect()
    await m.stop()
    expect(m.getStatus()).toBe("idle")
  })
})

// ── connect / disconnect ────────────────────────────────────────────────────
describe("connect / disconnect", () => {
  it("connects through the provider and notifies the delegate", async () => {
    provider.connectionStatus = "disconnected"
    const m = makeManager()
    await m.connect()
    expect(m.getConnectionStatus()).toBe("connected")
    expect(delegate.onConnect).toHaveBeenCalledTimes(1)
  })

  it("marks the connection errored and rethrows when connect fails", async () => {
    provider.connectError = new Error("auth denied")
    const m = makeManager()
    await expect(m.connect()).rejects.toThrow("auth denied")
    expect(delegate.onConnect).not.toHaveBeenCalled()
    nullifyProvider(m) // expose the internal fallback status
    expect(m.getConnectionStatus()).toBe("error")
  })

  it("disconnect clears the read cache (memory + Dexie) and re-hydrates next sync", async () => {
    provider.setRemoteFile("device-b", makeSnapshot("device-b"), "tok-b")
    const m = makeManager()
    await m.syncNow()
    expect(mocks.querySyncReadCache).toHaveBeenCalledTimes(1)

    await m.disconnect()
    expect(provider.disconnectCalls).toBe(1)
    expect(mocks.clearSyncReadCache).toHaveBeenCalledWith(KIND)
    expect(m.getConnectionStatus()).toBe("disconnected")

    await m.syncNow()
    expect(mocks.querySyncReadCache).toHaveBeenCalledTimes(2) // hydration reset
    // In-memory cache was dropped too: the unchanged file is re-downloaded.
    expect(provider.readCalls).toEqual(["file-device-b", "file-device-b"])
  })

  it("marks the connection errored and rethrows when disconnect fails", async () => {
    provider.disconnectError = new Error("revoke failed")
    const m = makeManager()
    await expect(m.disconnect()).rejects.toThrow("revoke failed")
    nullifyProvider(m)
    expect(m.getConnectionStatus()).toBe("error")
  })
})
