import "fake-indexeddb/auto"

import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type {
  RepeatLedgerEntity,
  RepeatPointStatus,
} from "@/domain/entities/RepeatLedgerEntity"
import type { TagDefinition } from "@/domain/entities/TagDefinition"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  DayRunEntity,
  TaskRuntimeSource,
  TaskRuntimeStatus,
} from "@/domain/entities/TaskRuntimeEntity"
import {
  LocalDateKeySchema,
  type LocalDateKey,
} from "@/domain/value-objects/schemas"
import { db, type RecordMetaRow } from "@/persistence/db"

export const dk = (value: string): LocalDateKey =>
  LocalDateKeySchema.parse(value)

/** Wipe and recreate the singleton database between tests. */
export async function resetDb(): Promise<void> {
  await db.delete()
  await db.open()
}

export function makeGoal(
  id: string,
  patch: Partial<GoalEntity> = {}
): GoalEntity {
  return {
    id,
    title: `Goal ${id}`,
    createdAt: new Date("2026-07-01T09:00:00"),
    ...patch,
  }
}

export function makeTask(
  id: string,
  patch: Partial<TaskGroupEntity> = {}
): TaskGroupEntity {
  return {
    id,
    title: `Task ${id}`,
    createdAt: new Date("2026-07-01T10:00:00"),
    total: 1,
    completedCount: 0,
    ...patch,
  }
}

export function makeActivity(
  id: string,
  taskId: string,
  patch: Partial<ActivityEntity> = {}
): ActivityEntity {
  return {
    id,
    kind: "task-done",
    taskId,
    runtimeId: taskId,
    recordedDateKey: dk("2026-07-20"),
    recordedAt: new Date("2026-07-20T12:00:00"),
    taskTitleSnapshot: `Task ${taskId}`,
    ...patch,
  }
}

interface RunPatch {
  arrangementStatus?: TaskRuntimeStatus
  source?: TaskRuntimeSource
  plannedForDate?: LocalDateKey
  stepsCompleted?: string[]
}

export function makeRun(
  id: string,
  taskId: string,
  dateKey: string,
  patch: RunPatch = {}
): DayRunEntity {
  return {
    id,
    taskId,
    arrangementStatus: "todo",
    source: "default",
    dateKey: dk(dateKey),
    ...patch,
  } as DayRunEntity
}

export function makeDep(
  id: string,
  goalId: string,
  tree: DependencyEntity["tree"] = []
): DependencyEntity {
  return { id, belongTo: goalId, tree }
}

/** A goal-root + one task node tree, matching the app's dependency layout. */
export function makeGoalTaskTree(
  goalId: string,
  taskId: string
): DependencyEntity["tree"] {
  return [
    { data: goalId, title: `Goal ${goalId}`, parent: null, children: [1] },
    { data: taskId, title: `Task ${taskId}`, parent: [0], children: null },
  ]
}

export function makeTag(
  id: string,
  name: string,
  kind: TagDefinition["kind"] = "custom"
): TagDefinition {
  return { id, name, color: "#123456", iconKey: "Tag", kind }
}

export function makeLedger(
  taskId: string,
  points: Record<string, RepeatPointStatus> = {}
): RepeatLedgerEntity {
  return { taskId, points: points as RepeatLedgerEntity["points"] }
}

export async function getMeta(key: string): Promise<RecordMetaRow | undefined> {
  return db.recordMeta.get(key)
}

export async function expectLiveMeta(key: string): Promise<void> {
  const meta = await getMeta(key)
  if (!meta) throw new Error(`expected live recordMeta for ${key}, found none`)
  if (meta.deletedAt !== null)
    throw new Error(`expected live recordMeta for ${key}, found tombstone`)
}

export async function expectTombstone(key: string): Promise<void> {
  const meta = await getMeta(key)
  if (!meta) throw new Error(`expected tombstone for ${key}, found none`)
  if (meta.deletedAt == null)
    throw new Error(`expected tombstone for ${key}, found live meta`)
}
