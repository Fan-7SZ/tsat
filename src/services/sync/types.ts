export const SYNC_PROVIDER_KINDS = ["google-drive", "onedrive"] as const
export type SyncProviderKind = (typeof SYNC_PROVIDER_KINDS)[number]

/** The status of connection availability of sync service */
export type SyncConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "connecting"

/** The working status of sync process */
export type SyncStatus = "idle" | "syncing" | "error"

/**
 * The payload structure for sync data exchange.
 * @property syncedAt - The timestamp when the data was synced, in ISO 8601 format.
 * @property dataHash - A hash of the entity data used for change detection.
 * @property data - The actual data being synced, which can be of any type (generic T).
 */
export interface SyncPayload<T = unknown> {
  syncedAt: string // ISO 8601
  dataHash: string // hash of the entity data for change detection
  data: T
}
/**
 * The occupied status indicates whether the sync service is currently in use by another instance or available for connection.
 * Used to lock the selection component
 */
export type OccupiedStatus = "occupied" | "available"

/**
 * Metadata information for sync operations.
 * @property dataHash - A hash representing the current state of the data, used for change detection.
 * @property syncedAt - The timestamp of the last successful sync operation, in ISO 8601 format.
 */
export interface SyncMeta {
  dataHash: string
  syncedAt: string
}

import type { EntitySnapshot } from "@/persistence/repository"
import type { AppMetaRow } from "@/persistence/db"
import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"

/**
 * The factual data structure that is exchanged during sync operations,
 * where used in the SyncPayload.data field.
 */
export interface SyncData {
  entities: EntitySnapshot
  tags: TagDefinition[]
  activities: ActivityEntity[]
  /** Run facts (dayRuns table), merged record-level like every other table. */
  dayRuns: DayRunEntity[]
  /** Synced cross-device scalars (appMeta table), record-level LWW. */
  appMeta: AppMetaRow[]
}

// ── Record-level merge (per-device file model) ──────────────────────────────

/**
 * Per-record sync metadata used for last-write-wins merge. Kept in a sidecar
 * (Dexie `recordMeta` table + serialized in each device file) so domain
 * entities and read paths stay untouched.
 * @property updatedAt - epoch ms of the last write (Date.now()).
 * @property deletedAt - epoch ms of deletion (tombstone), or null if live.
 */
export interface RecordMetaEntry {
  updatedAt: number
  deletedAt: number | null
}

/** Keyed by `"<table>:<id>"`, e.g. `"tasks:abc"`. */
export type RecordMetaMap = Record<string, RecordMetaEntry>

/** Current device-file schema version; bump on incompatible format changes. */
// v2: the runtime blob is gone — dayRuns + appMeta ride record-level LWW.
export const DEVICE_SNAPSHOT_SCHEMA_VERSION = 2

/**
 * One device's full contribution, stored as `track-sync-data-<deviceId>.json`.
 * Each device is the sole writer of its own file (no cross-device write
 * contention), so merges happen on read.
 */
export interface DeviceSnapshot {
  schemaVersion: number
  deviceId: string
  syncedAt: string // ISO 8601 of the last write by this device
  contentHash: string // sha256 over canonical(data + recordMeta)
  data: SyncData
  recordMeta: RecordMetaMap
}

/** A device data file discovered by listing the cloud folder. */
export interface DeviceFileRef {
  deviceId: string
  fileId: string
  /** Opaque provider change marker (Drive md5Checksum / OneDrive eTag). */
  changeToken?: string
}
