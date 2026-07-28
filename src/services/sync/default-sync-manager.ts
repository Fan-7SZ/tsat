import type { SyncProvider } from "./sync-provider"
import { isWorkerBackedProvider } from "./sync-provider"
import type { SyncManagerDelegate, SyncManager } from "./sync-manager"
import type { SyncPanelStatus, SyncPanelErrorCode } from "./sync-panel-types"
import type {
  OccupiedStatus,
  SyncConnectionStatus,
  SyncData,
  SyncProviderKind,
  SyncStatus,
  DeviceSnapshot,
  RecordMetaMap,
} from "./types"
import { DEVICE_SNAPSHOT_SCHEMA_VERSION } from "./types"
import {
  queryEntitySnapshot,
  queryDayRuns,
  queryAppMetaRows,
  queryAllTags,
  queryAllActivities,
  queryAllRecordMeta,
  gcTombstones,
  gcStaleIntentRecords,
  applyRemoteSnapshot,
  querySyncReadCache,
  replaceSyncReadCache,
  clearSyncReadCache,
} from "@/persistence/repository"
import { useAppStore } from "@/store/app-store"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { toLocalDateKey } from "@/utils/date"
import { withApplyingRemote } from "./sync-broadcast"
import { sha256Hex } from "@/utils/hash"
import { getDeviceId } from "./device-id"
import { mergeDeviceSnapshots, type MergeResult } from "./merge-engine"

const TOMBSTONE_HORIZON_MS = 90 * 24 * 60 * 60 * 1000 // 90 days
const ABANDONED_FILE_HORIZON_MS = 180 * 24 * 60 * 60 * 1000 // 180 days
const INTENT_GC_HORIZON_DAYS = 7

/** Intent records with a dateKey before this are expired on every device. */
function intentGcCutoffKey(now: Date): LocalDateKey {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - INTENT_GC_HORIZON_DAYS)
  return toLocalDateKey(cutoff)
}

/**
 * Deterministic JSON with recursively sorted keys (and Date → ISO), so the same
 * logical content always hashes to the same value regardless of property order
 * or input file order. Used for change-detection (upload/apply skip).
 */
function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return "null"
  if (typeof value !== "object") return JSON.stringify(value)
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalStringify).join(",") + "]"
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonicalStringify(obj[k])).join(",") +
    "}"
  )
}

/**
 * Per-device-file sync manager. Each device owns one cloud file; sync lists all
 * device files, record-level merges them with the local state (LWW + tombstones),
 * applies the merged result locally, and writes back only its own file. No
 * cross-device write contention, so no conflict dialog is needed.
 */
export class DefaultSyncManager implements SyncManager {
  private status: SyncStatus = "idle"
  private connectionStatus: SyncConnectionStatus = "disconnected"
  private providerKind: SyncProviderKind | null = null
  private lastSyncedAt: string | null = null
  private lastSyncError: string | null = null
  private delegate: SyncManagerDelegate | null = null
  private provider: SyncProvider | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  // Content hash (canonical) of the last-written device file — upload-skip.
  private lastWrittenContentHash: string | null = null
  // Content hash last applied locally — apply-skip.
  private lastAppliedContentHash: string | null = null
  // fileId → last seen change token + parsed snapshot — download-skip.
  // Persisted to Dexie (syncReadCache) so the first pull of a fresh session
  // can also skip unchanged files; hydrated lazily on the first syncNow.
  private readCache = new Map<
    string,
    { changeToken?: string; snapshot: DeviceSnapshot }
  >()
  private readCacheHydration: Promise<void> | null = null

  constructor(
    provider: SyncProvider,
    delegate: SyncManagerDelegate,
    lastKnownHashData: string | null = null,
    lastSyncedAt: string | null = null
  ) {
    this.provider = provider
    this.delegate = delegate
    this.providerKind = provider.providerKind as SyncProviderKind
    this.lastWrittenContentHash = lastKnownHashData
    this.lastAppliedContentHash = lastKnownHashData
    this.lastSyncedAt = lastSyncedAt
  }

  getStatus(): SyncStatus {
    return this.status
  }
  getConnectionStatus(): SyncConnectionStatus {
    return this.provider?.getConnectionStatus() ?? this.connectionStatus
  }
  getOccupiedStatus(): OccupiedStatus {
    return this.provider?.getOccupiedStatus() ?? "available"
  }
  getProviderKind(): SyncProviderKind | null {
    return this.providerKind
  }
  getLastSyncedAt(): string | null {
    return this.lastSyncedAt
  }
  getLastKnownHashData(): string | null {
    return this.lastWrittenContentHash
  }
  getLastSyncError(): string | null {
    return this.lastSyncError
  }
  getProvider(): SyncProvider | null {
    return this.provider
  }
  getPanelStatus(): SyncPanelStatus {
    return isWorkerBackedProvider(this.provider)
      ? this.provider.getPanelStatus()
      : "unauthorized"
  }
  getLastErrorCode(): SyncPanelErrorCode | null {
    return isWorkerBackedProvider(this.provider)
      ? this.provider.getLastErrorCode()
      : null
  }

  //MARK: syncNow()
  async syncNow(): Promise<void> {
    if (!this.provider) return
    // Single-flight: the interval timer and visibility handler call this
    // directly; overlapping runs would interleave their snapshot→apply phases.
    if (this.status === "syncing") return
    this.status = "syncing"
    try {
      await this.ensureReadCacheHydrated()
      const deviceId = getDeviceId()
      const local = await this.buildLocalSnapshot(deviceId)
      const refs = await this.provider.listDeviceDataFiles()

      const now = Date.now()
      const remoteSnaps: DeviceSnapshot[] = []
      let ownFilePresent = false
      const nextReadCache = new Map<
        string,
        { changeToken?: string; snapshot: DeviceSnapshot }
      >()

      for (const ref of refs) {
        if (ref.deviceId === deviceId) {
          ownFilePresent = true
          continue
        }
        // Download-skip: unchanged file (same provider change token) ⇒ reuse.
        const cached = this.readCache.get(ref.fileId)
        if (cached && ref.changeToken && cached.changeToken === ref.changeToken) {
          if (!this.isAbandoned(cached.snapshot, now)) remoteSnaps.push(cached.snapshot)
          nextReadCache.set(ref.fileId, cached)
          continue
        }
        let snap: DeviceSnapshot | null = null
        try {
          // readDeviceData zod-validates the shape; malformed/partial JSON
          // throws and is skipped this cycle (retried next).
          snap = await this.provider.readDeviceData(ref)
        } catch {
          snap = null
        }
        if (snap && snap.schemaVersion === DEVICE_SNAPSHOT_SCHEMA_VERSION) {
          nextReadCache.set(ref.fileId, { changeToken: ref.changeToken, snapshot: snap })
          if (!this.isAbandoned(snap, now)) remoteSnaps.push(snap)
        }
      }
      this.readCache = nextReadCache
      // Mirror to Dexie before merge/apply — same semantics as the in-memory
      // cache: a cached file still participates in every merge, so persisting
      // early can never cause a remote change to be skipped un-applied.
      this.persistReadCache()

      const merged = mergeDeviceSnapshots([local, ...remoteSnaps])
      const mergedHash = await this.contentHash(merged.data, merged.recordMeta)

      // Apply locally only when the converged content changed.
      if (mergedHash !== this.lastAppliedContentHash) {
        await this.applyMerged(merged)
        this.lastAppliedContentHash = mergedHash
      }

      // Write own file when content changed OR this device's file is missing remotely
      // (e.g. after "clear archive" wiped it) so the data re-seeds.
      const syncedAt = new Date().toISOString()
      if (mergedHash !== this.lastWrittenContentHash || !ownFilePresent) {
        const own: DeviceSnapshot = {
          schemaVersion: DEVICE_SNAPSHOT_SCHEMA_VERSION,
          deviceId,
          syncedAt,
          contentHash: mergedHash,
          data: merged.data,
          recordMeta: merged.recordMeta,
        }
        await this.provider.writeOwnDeviceData(own)
        this.lastWrittenContentHash = mergedHash
      }

      this.lastSyncedAt = syncedAt
      void gcTombstones(TOMBSTONE_HORIZON_MS).catch(() => {})
      // Day-scoped intent records (manual focus / dismissals) go inert once
      // their day passes — the sweep no longer clears them (that raced other
      // devices' still-yesterday writes), so they are GC'd here instead.
      void gcStaleIntentRecords(intentGcCutoffKey(new Date())).catch(() => {})
      await this.delegate?.onSyncNow?.()
      this.status = "idle"
      this.lastSyncError = null
    } catch (error) {
      console.error("[sync] syncNow failed:", error)
      this.status = "error"
      this.lastSyncError = error instanceof Error ? error.message : String(error)
    }
  }

  //MARK: start()
  async start(): Promise<void> {
    if (this.timer) return
    await this.delegate?.onStart?.()
    const interval = 1000 * 60 // every 1 minute
    this.timer = setInterval(() => {
      this.syncNow()
    }, interval)
  }

  //MARK: stop()
  async stop(): Promise<void> {
    await this.delegate?.onStop?.()
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  // MARK: connect()
  async connect(): Promise<void> {
    if (!this.provider) return
    try {
      await this.provider.connect()
      this.connectionStatus = this.provider.getConnectionStatus()
      await this.delegate?.onConnect?.()
    } catch (e) {
      this.connectionStatus = "error"
      throw e
    }
  }

  // MARK: disconnect()
  async disconnect(): Promise<void> {
    if (!this.provider) return
    // The cached snapshots are other devices' data under the account being
    // disconnected — drop them (hygiene; stale rows would be harmless since
    // lookups are keyed by the listing's fileIds, but no reason to keep them).
    this.readCache.clear()
    this.readCacheHydration = null
    if (this.providerKind) {
      void clearSyncReadCache(this.providerKind).catch(() => {})
    }
    try {
      await this.provider.disconnect()
      this.connectionStatus = this.provider.getConnectionStatus()
    } catch (e) {
      this.connectionStatus = "error"
      throw e
    }
  }

  // ── Internals ──────────────────────────────────────────────
  /**
   * Fill readCache from Dexie once per manager. Only missing keys are added so
   * entries learned by an earlier sync in this session always win. Best-effort:
   * a failed hydrate just means cold-cache downloads, never a failed sync.
   */
  private ensureReadCacheHydrated(): Promise<void> {
    this.readCacheHydration ??= (async () => {
      const kind = this.providerKind
      if (!kind) return
      const rows = await querySyncReadCache(kind)
      for (const row of rows) {
        if (!this.readCache.has(row.fileId)) {
          this.readCache.set(row.fileId, {
            changeToken: row.changeToken,
            snapshot: row.snapshot,
          })
        }
      }
    })().catch(() => {})
    return this.readCacheHydration
  }

  /** Fire-and-forget mirror of readCache into Dexie (best-effort). */
  private persistReadCache(): void {
    const kind = this.providerKind
    if (!kind) return
    const rows = Array.from(this.readCache, ([fileId, entry]) => ({
      fileId,
      providerKind: kind,
      changeToken: entry.changeToken,
      snapshot: entry.snapshot,
    }))
    void replaceSyncReadCache(kind, rows).catch(() => {})
  }

  private async buildLocalSnapshot(deviceId: string): Promise<DeviceSnapshot> {
    const [snapshot, tags, activities, dayRuns, appMeta, recordMeta] =
      await Promise.all([
        queryEntitySnapshot(),
        queryAllTags(),
        queryAllActivities(),
        queryDayRuns(),
        queryAppMetaRows(),
        queryAllRecordMeta(),
      ])

    const data: SyncData = {
      entities: snapshot,
      tags,
      activities,
      dayRuns,
      appMeta,
    }
    const contentHash = await this.contentHash(data, recordMeta)
    return {
      schemaVersion: DEVICE_SNAPSHOT_SCHEMA_VERSION,
      deviceId,
      // Only used for abandoned-file detection; runtime LWW compares
      // data.runtime.updatedAt instead.
      syncedAt: this.lastSyncedAt ?? new Date(0).toISOString(),
      contentHash,
      data,
      recordMeta,
    }
  }

  private async applyMerged(merged: MergeResult): Promise<void> {
    // Wrap Dexie + Zustand writes so table hooks / store subscriber skip and
    // don't loop back as a local change.
    await withApplyingRemote(async () => {
      // Dexie: record-level LWW diff apply — local records written after the
      // snapshot was taken carry newer meta and survive (see applyRemoteSnapshot).
      await applyRemoteSnapshot({
        entities: merged.data.entities,
        tags: merged.data.tags,
        activities: merged.data.activities,
        dayRuns: merged.data.dayRuns ?? [],
        appMeta: merged.data.appMeta ?? [],
        recordMeta: merged.recordMeta,
      })
      // Everything is per-record now — re-derive the plan from the freshly
      // merged tables. "partial" is deterministic and idempotent across
      // devices, so this converges without ping-pong and without redoing
      // another device's free-fill.
      await useAppStore.getState().replan("partial")
    })
  }

  /**
   * Canonical content hash, used only for upload/apply de-duplication
   * (mergedHash vs lastWritten/lastApplied). Cross-device "did the file change"
   * detection uses the provider's change token (md5/eTag) from the folder
   * listing instead — see syncNow's download-skip.
   */
  private contentHash(data: SyncData, recordMeta: RecordMetaMap): Promise<string> {
    return sha256Hex(canonicalStringify({ data, recordMeta }))
  }

  private isAbandoned(snap: DeviceSnapshot, now: number): boolean {
    const t = Date.parse(snap.syncedAt)
    return !Number.isNaN(t) && t < now - ABANDONED_FILE_HORIZON_MS
  }
}
