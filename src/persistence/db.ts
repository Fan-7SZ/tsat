import Dexie, { type EntityTable } from "dexie"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { GoalTriggerState } from "@/domain/entities/TriggerEntity"
import type { TaskTriggerState } from "@/domain/entities/TaskTriggerEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type {
  ManualFocusRecord,
  DismissedTaskRecord,
} from "@/domain/entities/IntentRecord"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { DeviceSnapshot, RecordMetaEntry } from "@/services/sync/types"
import { isInApplyRemote, notifyChange } from "@/services/sync/sync-broadcast"

const DB_NAME = "track-db"

const DB_STORES_V1 = {
  goals: "id, tagId, dueAt",
  tasks: "id, goalId, dueAt",
  deps: "id, belongTo",
  activities:
    "id, kind, taskId, goalId, recordedAt, recordedDateKey, [taskId+recordedAt], [goalId+recordedAt], [kind+plannedForDate]",
  tags: "id, kind, name",
  goalTriggerStates: "goalId",
  taskTriggerStates: "taskId",
  repeatLedgers: "taskId",
} as const

// v3: per-record sync metadata for record-level LWW merge. `key` is
// `"<table>:<id>"`. `deletedAt` is left un-indexed (IndexedDB can't index null);
// tombstone GC scans the table, which stays small.
const DB_STORES_V3 = {
  ...DB_STORES_V1,
  recordMeta: "key",
  // Per-record user-intent, merged across devices via recordMeta LWW.
  manualFocuses: "goalId",
  dismissedTasks: "taskId",
} as const

// v4: persisted sync read cache — one row per remote device file, carrying the
// provider change token (Drive md5 / OneDrive eTag) plus the last parsed
// snapshot. Lets a fresh session's first pull skip downloading files whose
// change token is unchanged (the in-memory cache alone dies with the page).
const DB_STORES_V4 = {
  ...DB_STORES_V3,
  syncReadCache: "fileId, providerKind",
} as const

// v5: runtime facts move out of zustand — one row per run on a given day.
// `id` keeps the runtime-id encoding (taskId / taskId::date / taskId::run::date::N),
// so activity stable-id derivation is untouched. `dateKey` is the day-scoped
// GC key (see DayRunEntity).
const DB_STORES_V5 = {
  ...DB_STORES_V4,
  dayRuns: "id, taskId, dateKey",
} as const

// v6: tiny synced KV for cross-device scalars (record-level LWW like every
// other table). First occupant: lastFullReplanDateKey — the "another device
// already full-replanned today" guard.
const DB_STORES_V6 = {
  ...DB_STORES_V5,
  appMeta: "key",
} as const

/** One synced scalar; `key` names it, `value` is a JSON-safe primitive. */
export interface AppMetaRow {
  key: string
  value: string | number | null
}

/** Sidecar row carrying per-record updatedAt / tombstone. */
export interface RecordMetaRow extends RecordMetaEntry {
  /** `"<table>:<id>"` */
  key: string
}

/** Persisted copy of DefaultSyncManager's read cache (see DB_STORES_V4). */
export interface SyncReadCacheRow {
  fileId: string
  providerKind: string
  changeToken?: string
  snapshot: DeviceSnapshot
}

class TrackDB extends Dexie {
  goals!: EntityTable<GoalEntity, "id">
  tasks!: EntityTable<TaskGroupEntity, "id">
  deps!: EntityTable<DependencyEntity, "id">
  activities!: EntityTable<ActivityEntity, "id">
  tags!: EntityTable<TagDefinition, "id">
  goalTriggerStates!: EntityTable<GoalTriggerState, "goalId">
  taskTriggerStates!: EntityTable<TaskTriggerState, "taskId">
  repeatLedgers!: EntityTable<RepeatLedgerEntity, "taskId">
  manualFocuses!: EntityTable<ManualFocusRecord, "goalId">
  dismissedTasks!: EntityTable<DismissedTaskRecord, "taskId">
  recordMeta!: EntityTable<RecordMetaRow, "key">
  syncReadCache!: EntityTable<SyncReadCacheRow, "fileId">
  dayRuns!: EntityTable<DayRunEntity, "id">
  appMeta!: EntityTable<AppMetaRow, "key">
  constructor() {
    super(DB_NAME)

    this.version(1).stores(DB_STORES_V1)

    // v2: allowCrossDay moved from a trigger-only field to a task-level field.
    // Indexes are unchanged; just migrate existing data.
    this.version(2)
      .stores(DB_STORES_V1)
      .upgrade((tx) =>
        tx
          .table("tasks")
          .toCollection()
          .modify(
            (
              task: TaskGroupEntity & { trigger?: { allowCrossDay?: boolean } }
            ) => {
              const legacy = task.trigger?.allowCrossDay
              if (typeof legacy === "boolean") {
                task.allowCrossDay = legacy
                delete task.trigger!.allowCrossDay
              }
            }
          )
      )

    // v3: add recordMeta sidecar and backfill one row per existing record so
    // record-level merge has a baseline updatedAt for everything already local.
    this.version(3)
      .stores(DB_STORES_V3)
      .upgrade(async (tx) => {
        const now = Date.now()
        const rows: RecordMetaRow[] = []
        const add = (table: string, id: string, updatedAt: number) => {
          rows.push({ key: `${table}:${id}`, updatedAt, deletedAt: null })
        }
        const epoch = (value: unknown): number => {
          if (value instanceof Date) return value.getTime()
          if (typeof value === "string" || typeof value === "number") {
            const ms = new Date(value).getTime()
            return Number.isNaN(ms) ? now : ms
          }
          return now
        }
        await tx
          .table("goals")
          .toCollection()
          .each((g: GoalEntity) => add("goals", g.id, epoch(g.createdAt)))
        await tx
          .table("tasks")
          .toCollection()
          .each((t: TaskGroupEntity) => add("tasks", t.id, epoch(t.createdAt)))
        await tx
          .table("deps")
          .toCollection()
          .each((d: DependencyEntity) => add("deps", d.id, now))
        await tx
          .table("tags")
          .toCollection()
          .each((t: TagDefinition) => add("tags", t.id, now))
        await tx
          .table("activities")
          .toCollection()
          .each((a: ActivityEntity) =>
            add("activities", a.id, epoch(a.recordedAt))
          )
        await tx
          .table("goalTriggerStates")
          .toCollection()
          .each((s: GoalTriggerState) =>
            add("goalTriggerStates", s.goalId, now)
          )
        await tx
          .table("taskTriggerStates")
          .toCollection()
          .each((s: TaskTriggerState) =>
            add("taskTriggerStates", s.taskId, now)
          )
        await tx
          .table("repeatLedgers")
          .toCollection()
          .each((l: RepeatLedgerEntity) => add("repeatLedgers", l.taskId, now))
        if (rows.length > 0) {
          await tx.table("recordMeta").bulkPut(rows)
        }
      })

    // v4: new syncReadCache table only — no data migration needed.
    this.version(4).stores(DB_STORES_V4)

    // v5: new dayRuns table only. No seed migration from the old zustand
    // runtime blob — runtime is day-scoped, the next replan rebuilds today.
    this.version(5).stores(DB_STORES_V5)

    // v6: new appMeta table only.
    this.version(6).stores(DB_STORES_V6)
  }
}

function createTrackDb(): TrackDB {
  return new TrackDB()
}

export const db = createTrackDb()

let preparePromise: Promise<void> | null = null

function installSyncTriggers(db: TrackDB): void {
  const fire = () => {
    if (!isInApplyRemote()) notifyChange()
  }
  const install = (table: { hook: Dexie.Table["hook"] }) => {
    table.hook("creating", fire)
    table.hook("updating", fire)
    table.hook("deleting", fire)
  }
  install(db.goals)
  install(db.tasks)
  install(db.deps)
  install(db.activities)
  install(db.tags)
  install(db.goalTriggerStates)
  install(db.taskTriggerStates)
  install(db.repeatLedgers)
  install(db.manualFocuses)
  install(db.dismissedTasks)
  install(db.dayRuns)
  install(db.appMeta)
}

export function prepareTrackDb(): Promise<void> {
  if (!preparePromise) {
    preparePromise = db
      .open()
      .then(() => {
        installSyncTriggers(db)
      })
      .catch((error) => {
        preparePromise = null
        throw error
      })
  }

  return preparePromise
}
