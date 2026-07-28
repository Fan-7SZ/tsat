import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { GoalTriggerState } from "@/domain/entities/TriggerEntity"
import type { TaskTriggerState } from "@/domain/entities/TaskTriggerEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type {
  ManualFocusRecord,
  DismissedTaskRecord,
} from "@/domain/entities/IntentRecord"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { AppMetaRow } from "@/persistence/db"
import type { EntitySnapshot } from "@/persistence/repository"

import type {
  DeviceSnapshot,
  RecordMetaEntry,
  RecordMetaMap,
  SyncData,
} from "./types"

export interface MergeResult {
  data: SyncData
  recordMeta: RecordMetaMap
}

/** The synced Dexie tables, with how to extract each record's id. */
export const TABLES = [
  "goals",
  "tasks",
  "deps",
  "tags",
  "activities",
  "goalTriggerStates",
  "taskTriggerStates",
  "repeatLedgers",
  "manualFocuses",
  "dismissedTasks",
  "dayRuns",
  "appMeta",
] as const
export type SyncTable = (typeof TABLES)[number]

function recordKey(table: SyncTable, id: string): string {
  return `${table}:${id}`
}

/** The record-bearing part of SyncData (runtime is merged separately). */
export type SyncRecordData = Pick<
  SyncData,
  "entities" | "tags" | "activities" | "dayRuns" | "appMeta"
>

/** Pull a table's records out of a snapshot's data as an id→record map. */
export function recordsOfData(
  data: SyncRecordData,
  table: SyncTable
): Map<string, unknown> {
  const out = new Map<string, unknown>()
  const e = data.entities
  switch (table) {
    case "goals":
      for (const r of Object.values(e.goals)) out.set(r.id, r)
      break
    case "tasks":
      for (const r of Object.values(e.tasks)) out.set(r.id, r)
      break
    case "deps":
      for (const r of Object.values(e.deps)) out.set(r.id, r)
      break
    case "tags":
      for (const r of data.tags) out.set(r.id, r)
      break
    case "activities":
      for (const r of data.activities) out.set(r.id, r)
      break
    case "goalTriggerStates":
      for (const r of Object.values(e.goalTriggerStates)) out.set(r.goalId, r)
      break
    case "taskTriggerStates":
      for (const r of Object.values(e.taskTriggerStates)) out.set(r.taskId, r)
      break
    case "repeatLedgers":
      for (const r of Object.values(e.repeatLedgers)) out.set(r.taskId, r)
      break
    case "manualFocuses":
      for (const r of Object.values(e.manualFocuses)) out.set(r.goalId, r)
      break
    case "dismissedTasks":
      for (const r of Object.values(e.dismissedTasks)) out.set(r.taskId, r)
      break
    case "dayRuns":
      for (const r of data.dayRuns ?? []) out.set(r.id, r)
      break
    case "appMeta":
      for (const r of data.appMeta ?? []) out.set(r.key, r)
      break
  }
  return out
}

function recordsOf(
  snap: DeviceSnapshot,
  table: SyncTable
): Map<string, unknown> {
  return recordsOfData(snap.data, table)
}

interface Candidate {
  deviceId: string
  meta: RecordMetaEntry
  record: unknown | undefined // present iff live on that device
}

/**
 * Tables where a tombstone is authoritative: once ANY device has deleted the
 * record, no concurrent or later write may resurrect it — a goal/task deletion
 * is a user decision, while the competing writes are typically automated
 * (trigger fires, counter recomputes) on replicas that have not yet pulled the
 * deletion. Safe only because goal/task ids are never reused; keyed tables
 * that legitimately delete and recreate the same id (manualFocuses,
 * dismissedTasks, dayRuns, trigger states, appMeta, …) must stay pure LWW.
 */
const DELETE_WINS_TABLES: ReadonlySet<SyncTable> = new Set(["goals", "tasks"])

/**
 * Pick the winning candidate for one record key. Deterministic:
 *   0. in a delete-wins table, tombstones only compete with tombstones
 *   1. larger updatedAt wins
 *   2. a tombstone beats a live write at the same updatedAt
 *   3. otherwise larger deviceId wins (string compare)
 * Within a single device, live ⇒ deletedAt=null, dead ⇒ deletedAt=updatedAt
 * (see repository stamping), so updatedAt is the event time in all cases.
 */
function pickWinner(candidates: Candidate[], deleteWins: boolean): Candidate {
  const pool = deleteWins
    ? candidates.filter((c) => c.meta.deletedAt != null)
    : []
  return (pool.length > 0 ? pool : candidates).reduce((best, c) => {
    if (c.meta.updatedAt !== best.meta.updatedAt) {
      return c.meta.updatedAt > best.meta.updatedAt ? c : best
    }
    const cDead = c.meta.deletedAt != null
    const bestDead = best.meta.deletedAt != null
    if (cDead !== bestDead) {
      return cDead ? c : best
    }
    return c.deviceId > best.deviceId ? c : best
  })
}

/**
 * Merge N device snapshots into one converged full snapshot + recordMeta via
 * record-level last-write-wins with tombstones; goals and tasks are
 * delete-wins instead (see DELETE_WINS_TABLES). Order-independent
 * (deterministic output for the same input set) so all devices compute
 * identical content.
 */
export function mergeDeviceSnapshots(snaps: DeviceSnapshot[]): MergeResult {
  const mergedRecords: Record<SyncTable, Map<string, unknown>> = {
    goals: new Map(),
    tasks: new Map(),
    deps: new Map(),
    tags: new Map(),
    activities: new Map(),
    goalTriggerStates: new Map(),
    taskTriggerStates: new Map(),
    repeatLedgers: new Map(),
    manualFocuses: new Map(),
    dismissedTasks: new Map(),
    dayRuns: new Map(),
    appMeta: new Map(),
  }
  const recordMeta: RecordMetaMap = {}

  for (const table of TABLES) {
    // Collect candidates per key across all devices.
    const byKey = new Map<string, Candidate[]>()
    for (const snap of snaps) {
      const records = recordsOf(snap, table)
      // Keys known via meta (covers tombstones with no record) ∪ live records.
      const keys = new Set<string>(records.keys())
      for (const metaKey of Object.keys(snap.recordMeta)) {
        if (metaKey.startsWith(`${table}:`)) {
          keys.add(metaKey.slice(table.length + 1))
        }
      }
      for (const id of keys) {
        const meta = snap.recordMeta[recordKey(table, id)] ?? {
          updatedAt: 0,
          deletedAt: null,
        }
        const record = meta.deletedAt == null ? records.get(id) : undefined
        // Defensive: live meta but missing record ⇒ ignore this device's entry.
        if (meta.deletedAt == null && record === undefined) continue
        const list = byKey.get(id) ?? []
        list.push({ deviceId: snap.deviceId, meta, record })
        byKey.set(id, list)
      }
    }

    for (const [id, candidates] of byKey) {
      if (candidates.length === 0) continue
      const winner = pickWinner(candidates, DELETE_WINS_TABLES.has(table))
      recordMeta[recordKey(table, id)] = {
        updatedAt: winner.meta.updatedAt,
        deletedAt: winner.meta.deletedAt,
      }
      if (winner.meta.deletedAt == null && winner.record !== undefined) {
        mergedRecords[table].set(id, winner.record)
      }
    }
  }

  const entities: EntitySnapshot = {
    goals: mapToRecord(mergedRecords.goals) as Record<string, GoalEntity>,
    tasks: mapToRecord(mergedRecords.tasks) as Record<string, TaskGroupEntity>,
    deps: mapToRecord(mergedRecords.deps) as Record<string, DependencyEntity>,
    goalTriggerStates: mapToRecord(
      mergedRecords.goalTriggerStates
    ) as Record<string, GoalTriggerState>,
    taskTriggerStates: mapToRecord(
      mergedRecords.taskTriggerStates
    ) as Record<string, TaskTriggerState>,
    repeatLedgers: mapToRecord(
      mergedRecords.repeatLedgers
    ) as Record<string, RepeatLedgerEntity>,
    manualFocuses: mapToRecord(
      mergedRecords.manualFocuses
    ) as Record<string, ManualFocusRecord>,
    dismissedTasks: mapToRecord(
      mergedRecords.dismissedTasks
    ) as Record<string, DismissedTaskRecord>,
  }

  const data: SyncData = {
    entities,
    tags: [...mergedRecords.tags.values()] as TagDefinition[],
    activities: [...mergedRecords.activities.values()] as ActivityEntity[],
    dayRuns: [...mergedRecords.dayRuns.values()] as DayRunEntity[],
    appMeta: [...mergedRecords.appMeta.values()] as AppMetaRow[],
  }

  return repairReferentialIntegrity({ data, recordMeta })
}

function mapToRecord(map: Map<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of map) out[k] = v
  return out
}


/**
 * Drop records whose parent is gone after merge (a child edited on one device
 * while its parent was deleted on another resurrects the child but not the
 * parent). Tombstone them deterministically (deletedAt = updatedAt, no clock)
 * so every device converges to the same result and the deletion propagates.
 */
export function repairReferentialIntegrity(merged: MergeResult): MergeResult {
  const { data, recordMeta } = merged
  const e = data.entities
  const goalIds = new Set(Object.keys(e.goals))
  const taskIds = new Set(Object.keys(e.tasks))

  const tombstone = (table: SyncTable, id: string) => {
    const key = recordKey(table, id)
    const prev = recordMeta[key]
    const updatedAt = prev?.updatedAt ?? 0
    recordMeta[key] = { updatedAt, deletedAt: updatedAt }
  }

  // tasks whose goal is gone
  for (const [id, task] of Object.entries(e.tasks)) {
    if (task.goalId != null && !goalIds.has(task.goalId)) {
      delete e.tasks[id]
      taskIds.delete(id)
      tombstone("tasks", id)
    }
  }
  // deps whose goal is gone
  for (const [id, dep] of Object.entries(e.deps)) {
    if (!goalIds.has(dep.belongTo)) {
      delete e.deps[id]
      tombstone("deps", id)
    }
  }
  // ledgers / task-trigger-states whose task is gone
  for (const id of Object.keys(e.repeatLedgers)) {
    if (!taskIds.has(id)) {
      delete e.repeatLedgers[id]
      tombstone("repeatLedgers", id)
    }
  }
  for (const id of Object.keys(e.taskTriggerStates)) {
    if (!taskIds.has(id)) {
      delete e.taskTriggerStates[id]
      tombstone("taskTriggerStates", id)
    }
  }
  // goal-trigger-states whose goal is gone
  for (const id of Object.keys(e.goalTriggerStates)) {
    if (!goalIds.has(id)) {
      delete e.goalTriggerStates[id]
      tombstone("goalTriggerStates", id)
    }
  }
  // manual focuses whose goal is gone
  for (const id of Object.keys(e.manualFocuses)) {
    if (!goalIds.has(id)) {
      delete e.manualFocuses[id]
      tombstone("manualFocuses", id)
    }
  }
  // dismissed tasks whose task is gone
  for (const id of Object.keys(e.dismissedTasks)) {
    if (!taskIds.has(id)) {
      delete e.dismissedTasks[id]
      tombstone("dismissedTasks", id)
    }
  }
  // activities whose task is gone
  data.activities = data.activities.filter((a) => {
    if (!taskIds.has(a.taskId)) {
      tombstone("activities", a.id)
      return false
    }
    return true
  })
  // day runs whose task is gone
  data.dayRuns = (data.dayRuns ?? []).filter((run) => {
    if (!taskIds.has(run.taskId)) {
      tombstone("dayRuns", run.id)
      return false
    }
    return true
  })

  return { data, recordMeta }
}
