import Dexie from "dexie"
import { db, type AppMetaRow, type SyncReadCacheRow } from "./db"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import {
  createStableActivityId,
  type ActivityEntity,
} from "@/domain/entities/ActivityEntity"
import type {
  GoalID,
  TaskID,
  DependencyEntityID,
  ActivityID,
  TagID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { TagDefinition } from "@/domain/entities/TagDefinition"
import { PRESET_TAGS } from "@/domain/entities/preset-tags"
import type { GoalTriggerState } from "@/domain/entities/TriggerEntity"
import type { TaskTriggerState } from "@/domain/entities/TaskTriggerEntity"
import type { GoalTriggerConfig } from "@/domain/entities/GoalEntity"
import type { TaskTriggerConfig } from "@/domain/entities/TaskGroupEntity"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import type {
  RepeatLedgerEntity,
  RepeatPointStatus,
} from "@/domain/entities/RepeatLedgerEntity"
import type {
  ManualFocusRecord,
  ManualFocusSource,
  DismissedTaskRecord,
} from "@/domain/entities/IntentRecord"
import {
  LocalDateKeySchema,
  type LocalDateKey,
} from "@/domain/value-objects/schemas"
import type { RecordMetaMap } from "@/services/sync/types"
import { buildApplyPlan } from "@/services/sync/apply-plan"
import { TABLES } from "@/services/sync/merge-engine"
import {
  appendFloatingTaskNode,
  removeTaskNodeFromTree,
} from "@/utils/dependency-tree-migration"
import { selectCrossDayCarryOver } from "@/utils/cross-day-sweep"

// ── Date helpers ──────────────────────────────────────────
// Dexie stores plain objects; Date fields become strings after round-trip.
// Normalised back on read so the rest of the app always sees Date objects.

// Repository access assumes IndexedDB has already been prepared during app bootstrap.

function reviveTriggerRuleDates(rule: triggerRule): triggerRule {
  if (rule.mode !== "custom") {
    return rule
  }

  return { ...rule, date: rule.date.map((date) => new Date(date)) }
}

export function reviveGoalDates(g: GoalEntity): GoalEntity {
  return {
    ...g,
    createdAt: new Date(g.createdAt),
    ...(g.dueAt && { dueAt: new Date(g.dueAt) }),
    ...(g.trigger && {
      trigger: { ...g.trigger, rule: reviveTriggerRuleDates(g.trigger.rule) },
    }),
  }
}

export function reviveTaskDates(t: TaskGroupEntity): TaskGroupEntity {
  return {
    ...t,
    createdAt: new Date(t.createdAt),
    ...(t.dueAt && { dueAt: new Date(t.dueAt) }),
    ...(t.repeat && {
      repeat: {
        ...t.repeat,
        ...(t.repeat.startsAt && { startsAt: new Date(t.repeat.startsAt) }),
        ...(t.repeat.endsAt && { endsAt: new Date(t.repeat.endsAt) }),
      },
    }),
    ...(t.trigger && {
      trigger: {
        ...t.trigger,
        rule: reviveTriggerRuleDates(t.trigger.rule),
        ...(t.trigger.startsAt && { startsAt: new Date(t.trigger.startsAt) }),
        ...(t.trigger.endsAt && { endsAt: new Date(t.trigger.endsAt) }),
      },
    }),
  }
}

export function reviveActivityDates(a: ActivityEntity): ActivityEntity {
  return {
    ...a,
    recordedAt: new Date(a.recordedAt),
    recordedDateKey: LocalDateKeySchema.parse(a.recordedDateKey),
    ...(a.plannedForDate != null && {
      plannedForDate: LocalDateKeySchema.parse(a.plannedForDate),
    }),
  }
}

function reviveGoalTriggerState(state: GoalTriggerState): GoalTriggerState {
  return state.lastTriggeredDateKey != null
    ? {
        ...state,
        lastTriggeredDateKey: LocalDateKeySchema.parse(
          state.lastTriggeredDateKey
        ),
      }
    : state
}

function reviveTaskTriggerState(state: TaskTriggerState): TaskTriggerState {
  return state.lastTriggeredDateKey != null
    ? {
        ...state,
        lastTriggeredDateKey: LocalDateKeySchema.parse(
          state.lastTriggeredDateKey
        ),
      }
    : state
}

function sortTags(tags: TagDefinition[]): TagDefinition[] {
  return [...tags].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "preset" ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })
}

// ── Snapshot (bulk read at boot) ──────────────────────────
export interface EntitySnapshot {
  goals: Record<GoalID, GoalEntity>
  tasks: Record<TaskID, TaskGroupEntity>
  deps: Record<DependencyEntityID, DependencyEntity>
  goalTriggerStates: Record<GoalID, GoalTriggerState>
  taskTriggerStates: Record<TaskID, TaskTriggerState>
  repeatLedgers: Record<TaskID, RepeatLedgerEntity>
  manualFocuses: Record<GoalID, ManualFocusRecord>
  dismissedTasks: Record<TaskID, DismissedTaskRecord>
}

export type SetGoalTriggerAtomicResult =
  | "saved"
  | "goal-not-found"
  | "repeat-tasks"

export type SetGoalTriggerWithNormalizationResult =
  | { result: "saved"; normalizedTaskIds: TaskID[] }
  | { result: "goal-not-found"; normalizedTaskIds: [] }

export type CreateGoalWithTriggerAtomicResult = "created" | "goal-exists"

export type RebindTaskGoalAtomicResult =
  | { result: "saved"; normalized: boolean }
  | { result: "task-not-found" }

export type DeleteGoalTriggerAtomicResult = "deleted" | "goal-not-found"

export type SetTaskTriggerAtomicResult =
  | "saved"
  | "task-not-found"
  | "repeat-task"

export type DeleteTaskTriggerAtomicResult = "deleted" | "task-not-found"

function buildEntityRecord<TId extends string, TEntity extends { id: TId }>(
  entities: TEntity[]
): Record<TId, TEntity> {
  return Object.fromEntries(
    entities.map((entity) => [entity.id, entity])
  ) as Record<TId, TEntity>
}

export async function queryEntitySnapshot(): Promise<EntitySnapshot> {
  const [
    goalArr,
    taskArr,
    depArr,
    goalStateArr,
    taskStateArr,
    ledgerArr,
    manualFocusArr,
    dismissedArr,
  ] = await Promise.all([
    db.goals.toArray(),
    db.tasks.toArray(),
    db.deps.toArray(),
    db.goalTriggerStates.toArray(),
    db.taskTriggerStates.toArray(),
    db.repeatLedgers.toArray(),
    db.manualFocuses.toArray(),
    db.dismissedTasks.toArray(),
  ])

  const goals = buildEntityRecord(goalArr.map(reviveGoalDates))
  const tasks = buildEntityRecord(taskArr.map(reviveTaskDates))
  const deps = buildEntityRecord(depArr)
  const goalTriggerStates = Object.fromEntries(
    goalStateArr.map((state) => [state.goalId, reviveGoalTriggerState(state)])
  ) as Record<GoalID, GoalTriggerState>
  const taskTriggerStates = Object.fromEntries(
    taskStateArr.map((state) => [state.taskId, reviveTaskTriggerState(state)])
  ) as Record<TaskID, TaskTriggerState>
  const repeatLedgers = Object.fromEntries(
    ledgerArr.map((ledger) => [ledger.taskId, ledger])
  ) as Record<TaskID, RepeatLedgerEntity>
  const manualFocuses = Object.fromEntries(
    manualFocusArr.map((record) => [record.goalId, record])
  ) as Record<GoalID, ManualFocusRecord>
  const dismissedTasks = Object.fromEntries(
    dismissedArr.map((record) => [record.taskId, record])
  ) as Record<TaskID, DismissedTaskRecord>

  return {
    goals,
    tasks,
    deps,
    goalTriggerStates,
    taskTriggerStates,
    repeatLedgers,
    manualFocuses,
    dismissedTasks,
  }
}

// ── Record-level sync metadata (sidecar) ──────────────────
// One `recordMeta` row per record carries updatedAt / tombstone for LWW merge.
// Stamped at every write/delete choke point; deletes keep a tombstone so the
// deletion propagates across devices. Helpers auto-enlist in the active Dexie
// transaction, so callers wrap entity write + stamp in one `db.transaction`.

type SyncTable =
  | "goals"
  | "tasks"
  | "deps"
  | "tags"
  | "activities"
  | "goalTriggerStates"
  | "taskTriggerStates"
  | "repeatLedgers"
  | "manualFocuses"
  | "dismissedTasks"
  | "dayRuns"
  | "appMeta"

function recordMetaKey(table: SyncTable, id: string): string {
  return `${table}:${id}`
}

async function stampWritten(table: SyncTable, id: string): Promise<void> {
  await db.recordMeta.put({
    key: recordMetaKey(table, id),
    updatedAt: Date.now(),
    deletedAt: null,
  })
}

async function stampDeleted(table: SyncTable, id: string): Promise<void> {
  const now = Date.now()
  await db.recordMeta.put({
    key: recordMetaKey(table, id),
    updatedAt: now,
    deletedAt: now,
  })
}

async function stampDeletedMany(
  table: SyncTable,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return
  const now = Date.now()
  await db.recordMeta.bulkPut(
    ids.map((id) => ({
      key: recordMetaKey(table, id),
      updatedAt: now,
      deletedAt: now,
    }))
  )
}

/** Full sidecar map for building this device's snapshot. */
export async function queryAllRecordMeta(): Promise<RecordMetaMap> {
  const rows = await db.recordMeta.toArray()
  const map: RecordMetaMap = {}
  for (const row of rows) {
    map[row.key] = { updatedAt: row.updatedAt, deletedAt: row.deletedAt }
  }
  return map
}

/** Drop tombstones older than the horizon (called opportunistically post-sync). */
export async function gcTombstones(horizonMs: number): Promise<number> {
  const cutoff = Date.now() - horizonMs
  const stale = await db.recordMeta
    .filter((r) => r.deletedAt != null && r.deletedAt < cutoff)
    .primaryKeys()
  if (stale.length > 0) {
    await db.recordMeta.bulkDelete(stale)
  }
  return stale.length
}

// ── Tags ──────────────────────────────────────────────────
export async function ensureTagCatalogReady(): Promise<void> {
  if (PRESET_TAGS.length === 0) {
    return
  }

  const existingTags = await db.tags.toArray()
  const existingIds = new Set(existingTags.map((tag) => tag.id))
  const missing = PRESET_TAGS.filter((tag) => !existingIds.has(tag.id))

  if (missing.length > 0) {
    await db.tags.bulkPut(missing)
  }
}

export async function queryAllTags(): Promise<TagDefinition[]> {
  const tags = await db.tags.toArray()
  return sortTags(tags)
}

export async function putTag(tag: TagDefinition) {
  return db.transaction("rw", [db.tags, db.recordMeta], async () => {
    const result = await db.tags.put(tag)
    await stampWritten("tags", tag.id)
    return result
  })
}

export async function deleteTag(id: TagID) {
  await db.transaction("rw", [db.tags, db.recordMeta], async () => {
    await db.tags.delete(id)
    await stampDeleted("tags", id)
  })
}

/**
 * Delete a tag and unbind it from every goal that references it, atomically.
 * Goals keep their identity; only their `tagId` is cleared.
 */
export async function deleteTagAndUnbindGoals(id: TagID) {
  await db.transaction("rw", [db.goals, db.tags, db.recordMeta], async () => {
    const affected = await db.goals.filter((g) => g.tagId === id).toArray()
    for (const goal of affected) {
      await db.goals.update(goal.id, { tagId: undefined })
      await stampWritten("goals", goal.id)
    }
    await db.tags.delete(id)
    await stampDeleted("tags", id)
  })
}

// ── Goal ──────────────────────────────────────────────────
export async function putGoal(goal: GoalEntity) {
  return db.transaction("rw", [db.goals, db.recordMeta], async () => {
    const result = await db.goals.put(goal)
    await stampWritten("goals", goal.id)
    return result
  })
}

export async function queryAllGoals(): Promise<GoalEntity[]> {
  const goals = await db.goals.toArray()
  return goals.map(reviveGoalDates)
}

export async function queryGoalById(
  goalId: GoalID
): Promise<GoalEntity | null> {
  const goal = await db.goals.get(goalId)
  return goal ? reviveGoalDates(goal) : null
}

export async function patchGoal(
  id: GoalID,
  patch: Partial<Omit<GoalEntity, "id">>
) {
  return db.transaction("rw", [db.goals, db.recordMeta], async () => {
    const count = await db.goals.update(id, patch)
    if (count > 0) await stampWritten("goals", id)
    return count
  })
}

export async function deleteGoal(id: GoalID) {
  await db.transaction("rw", [db.goals, db.recordMeta], async () => {
    await db.goals.delete(id)
    await stampDeleted("goals", id)
  })
}

// ── Task ──────────────────────────────────────────────────
export async function putTask(task: TaskGroupEntity) {
  return db.transaction("rw", [db.tasks, db.recordMeta], async () => {
    const result = await db.tasks.put(task)
    await stampWritten("tasks", task.id)
    return result
  })
}

/**
 * Insert several tasks in one transaction so reactive queries (and thus the UI)
 * update once — the tasks appear together instead of streaming in one by one.
 * `ledgerSync` lands each task's repeat ledger (null = ensure absent) in the
 * same transaction, so a repeat task never exists without its ledger.
 */
export async function putTasks(
  tasks: TaskGroupEntity[],
  ledgerSync?: Array<{ taskId: TaskID; ledger: RepeatLedgerEntity | null }>
) {
  if (tasks.length === 0) return
  return db.transaction(
    "rw",
    [db.tasks, db.repeatLedgers, db.recordMeta],
    async () => {
      await db.tasks.bulkPut(tasks)
      for (const task of tasks) {
        await stampWritten("tasks", task.id)
      }
      for (const { taskId, ledger } of ledgerSync ?? []) {
        if (ledger) {
          await db.repeatLedgers.put(ledger)
          await stampWritten("repeatLedgers", taskId)
        } else if (await db.repeatLedgers.get(taskId)) {
          await db.repeatLedgers.delete(taskId)
          await stampDeleted("repeatLedgers", taskId)
        }
      }
    }
  )
}

export async function queryAllTasks(): Promise<TaskGroupEntity[]> {
  const tasks = await db.tasks.toArray()
  return tasks.map(reviveTaskDates)
}

export async function queryTaskById(
  taskId: TaskID
): Promise<TaskGroupEntity | null> {
  const task = await db.tasks.get(taskId)
  return task ? reviveTaskDates(task) : null
}

export async function queryTasksByGoal(
  goalId: GoalID
): Promise<TaskGroupEntity[]> {
  const tasks = await db.tasks.where("goalId").equals(goalId).toArray()
  return tasks.map(reviveTaskDates)
}

export async function patchTask(
  id: TaskID,
  patch: Partial<Omit<TaskGroupEntity, "id">>
) {
  return db.transaction("rw", [db.tasks, db.recordMeta], async () => {
    const count = await db.tasks.update(id, patch)
    if (count > 0) await stampWritten("tasks", id)
    return count
  })
}

export async function deleteTask(id: TaskID) {
  await db.transaction("rw", [db.tasks, db.recordMeta], async () => {
    await db.tasks.delete(id)
    await stampDeleted("tasks", id)
  })
}

/**
 * Recompute a task's `completedCount` from its authoritative completion records
 * and persist it. `completedCount` is a cached PROJECTION of those records — the
 * single source of truth — so every completion path recomputes here rather than
 * incrementing in place: repeat tasks count their `completed` ledger points,
 * all others count their `task-done` activities. A run's completion is thus
 * always exactly one record, and the count can never drift from it.
 */
export async function recomputeCompletedCount(taskId: TaskID): Promise<void> {
  const task = await queryTaskById(taskId)
  if (!task) return
  let count: number
  if (task.repeat != null) {
    const ledger = await queryRepeatLedger(taskId)
    count = ledger
      ? Object.values(ledger.points).filter((s) => s === "completed").length
      : 0
  } else {
    const activities = await queryActivitiesByTask(taskId)
    count = activities.filter((a) => a.kind === "task-done").length
  }
  if (count !== task.completedCount) {
    await patchTask(taskId, { completedCount: count })
  }
}

// ── Dependency ────────────────────────────────────────────
export async function putDep(dep: DependencyEntity) {
  return db.transaction("rw", [db.deps, db.recordMeta], async () => {
    const result = await db.deps.put(dep)
    await stampWritten("deps", dep.id)
    return result
  })
}

export async function queryAllDeps(): Promise<DependencyEntity[]> {
  return db.deps.toArray()
}

export async function queryDependencyByGoal(
  goalId: GoalID
): Promise<DependencyEntity | null> {
  return (await db.deps.where("belongTo").equals(goalId).first()) ?? null
}

export async function queryDependencyById(
  id: DependencyEntityID
): Promise<DependencyEntity | null> {
  return (await db.deps.get(id)) ?? null
}

export async function patchDep(
  id: DependencyEntityID,
  patch: Partial<Omit<DependencyEntity, "id">>
) {
  return db.transaction("rw", [db.deps, db.recordMeta], async () => {
    const count = await db.deps.update(id, patch)
    if (count > 0) await stampWritten("deps", id)
    return count
  })
}

export async function deleteDep(id: DependencyEntityID) {
  await db.transaction("rw", [db.deps, db.recordMeta], async () => {
    await db.deps.delete(id)
    await stampDeleted("deps", id)
  })
}

// ── Activity ──────────────────────────────────────────────
export async function putActivity(activity: ActivityEntity) {
  return db.transaction("rw", [db.activities, db.recordMeta], async () => {
    const result = await db.activities.put(activity)
    await stampWritten("activities", activity.id)
    return result
  })
}

export async function deleteActivity(id: ActivityID) {
  await db.transaction("rw", [db.activities, db.recordMeta], async () => {
    await db.activities.delete(id)
    await stampDeleted("activities", id)
  })
}

export async function patchActivityDate(
  id: ActivityID,
  recordedDateKey: LocalDateKey
) {
  return db.transaction("rw", [db.activities, db.recordMeta], async () => {
    const count = await db.activities.update(id, { recordedDateKey })
    if (count > 0) await stampWritten("activities", id)
    return count
  })
}

export async function deleteActivitiesByTask(taskId: TaskID) {
  return db.transaction("rw", [db.activities, db.recordMeta], async () => {
    const ids = (await db.activities
      .where("taskId")
      .equals(taskId)
      .primaryKeys()) as ActivityID[]
    const count = await db.activities.where("taskId").equals(taskId).delete()
    await stampDeletedMany("activities", ids)
    return count
  })
}

export async function deleteActivitiesByGoal(goalId: GoalID) {
  return db.transaction("rw", [db.activities, db.recordMeta], async () => {
    const ids = (await db.activities
      .where("goalId")
      .equals(goalId)
      .primaryKeys()) as ActivityID[]
    const count = await db.activities.where("goalId").equals(goalId).delete()
    await stampDeletedMany("activities", ids)
    return count
  })
}

export async function queryRecentActivities(
  limit = 10
): Promise<ActivityEntity[]> {
  const results = await db.activities
    .orderBy("recordedAt")
    .reverse()
    .limit(limit)
    .toArray()
  return results.map(reviveActivityDates)
}

export async function queryActivitiesByTask(
  taskId: TaskID
): Promise<ActivityEntity[]> {
  const results = await db.activities
    .where("[taskId+recordedAt]")
    .between([taskId, Dexie.minKey], [taskId, Dexie.maxKey])
    .reverse()
    .toArray()
  return results.map(reviveActivityDates)
}

export async function queryActivitiesByGoal(
  goalId: GoalID,
  limit = 10
): Promise<ActivityEntity[]> {
  const results = await db.activities
    .where("[goalId+recordedAt]")
    .between([goalId, Dexie.minKey], [goalId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray()
  return results.map(reviveActivityDates)
}

export async function queryAllActivities(): Promise<ActivityEntity[]> {
  const arr = await db.activities.toArray()
  return arr.map(reviveActivityDates)
}

// ── Manual focus (per-goal, day-scoped user intent) ───────
export async function putManualFocus(
  goalId: GoalID,
  dateKey: LocalDateKey,
  source: ManualFocusSource = "manual"
) {
  return db.transaction("rw", [db.manualFocuses, db.recordMeta], async () => {
    await db.manualFocuses.put({ goalId, dateKey, source })
    await stampWritten("manualFocuses", goalId)
  })
}

export async function deleteManualFocus(goalId: GoalID) {
  await db.transaction("rw", [db.manualFocuses, db.recordMeta], async () => {
    await db.manualFocuses.delete(goalId)
    await stampDeleted("manualFocuses", goalId)
  })
}

// ── Dismissed tasks (per-task, day-scoped user intent) ────
export async function queryAllDismissedTasks(): Promise<DismissedTaskRecord[]> {
  return db.dismissedTasks.toArray()
}

export async function putDismissedTask(taskId: TaskID, dateKey: LocalDateKey) {
  return db.transaction("rw", [db.dismissedTasks, db.recordMeta], async () => {
    await db.dismissedTasks.put({ taskId, dateKey })
    await stampWritten("dismissedTasks", taskId)
  })
}

export async function deleteDismissedTask(taskId: TaskID) {
  await db.transaction("rw", [db.dismissedTasks, db.recordMeta], async () => {
    await db.dismissedTasks.delete(taskId)
    await stampDeleted("dismissedTasks", taskId)
  })
}

// ── App meta (synced cross-device scalars, record-level LWW) ──

export const LAST_FULL_REPLAN_KEY = "lastFullReplanDateKey"

export async function queryAppMetaRows(): Promise<AppMetaRow[]> {
  return db.appMeta.toArray()
}

export async function queryLastFullReplanDateKey(): Promise<LocalDateKey | null> {
  const row = await db.appMeta.get(LAST_FULL_REPLAN_KEY)
  return typeof row?.value === "string"
    ? LocalDateKeySchema.parse(row.value)
    : null
}

export async function putLastFullReplanDateKey(
  dateKey: LocalDateKey
): Promise<void> {
  await db.transaction("rw", [db.appMeta, db.recordMeta], async () => {
    await db.appMeta.put({ key: LAST_FULL_REPLAN_KEY, value: dateKey })
    await stampWritten("appMeta", LAST_FULL_REPLAN_KEY)
  })
}

// ── Day runs (runtime facts, day-scoped) ──────────────────

export async function queryDayRuns(): Promise<DayRunEntity[]> {
  return db.dayRuns.toArray()
}

export async function queryDayRun(
  id: TaskRuntimeID
): Promise<DayRunEntity | null> {
  return (await db.dayRuns.get(id)) ?? null
}

export async function queryDayRunsByTask(
  taskId: TaskID
): Promise<DayRunEntity[]> {
  return db.dayRuns.where("taskId").equals(taskId).toArray()
}

/**
 * One command's whole write-set, applied atomically by {@link applyRunMutation}.
 * Commands compute the set (pure logic stays in the slice); the repository
 * executes it in a single transaction.
 */
export interface RunMutation {
  putRuns?: DayRunEntity[]
  deleteRunIds?: TaskRuntimeID[]
  putActivities?: ActivityEntity[]
  deleteActivityIds?: ActivityID[]
  taskPatches?: Array<{ taskId: TaskID; patch: Partial<TaskGroupEntity> }>
  ledgerMarks?: Array<{
    taskId: TaskID
    dateKey: LocalDateKey
    status: RepeatPointStatus
  }>
  putDismissals?: Array<{ taskId: TaskID; dateKey: LocalDateKey }>
  deleteDismissalTaskIds?: TaskID[]
  /**
   * Runs to flip back from `done` to `todo` WITHOUT completion side effects —
   * the "undo" of a completion whose record is being deleted in this same
   * mutation. Read inside the transaction: ids that name no live run, or a run
   * no longer `done`, are no-ops.
   */
  retractDoneRunIds?: TaskRuntimeID[]
  /**
   * Tasks whose `completedCount` should be re-derived from their records at the
   * END of this transaction (after the activity/ledger writes above land). This
   * is how a completion updates the count — the count is a projection, never
   * incremented in place — while still committing atomically with its records.
   */
  recomputeCompletedCountFor?: TaskID[]
}

/**
 * Re-derives one task's `completedCount` from its records, inside the caller's
 * transaction. Same projection as {@link recomputeCompletedCount} — repeat tasks
 * count their completed ledger points, all others their `task-done` activities —
 * but it writes only when the value actually moved, so an untouched task keeps
 * its LWW clock and a deletion made on another device still wins the merge.
 * Callers must include tasks / activities / repeatLedgers / recordMeta in scope.
 */
async function recomputeCompletedCountInTx(taskId: TaskID): Promise<void> {
  const task = await db.tasks.get(taskId)
  if (!task) return
  let count: number
  if (task.repeat != null) {
    const ledger = await db.repeatLedgers.get(taskId)
    count = ledger
      ? Object.values(ledger.points).filter((s) => s === "completed").length
      : 0
  } else {
    const acts = await db.activities.where("taskId").equals(taskId).toArray()
    count = acts.filter((a) => a.kind === "task-done").length
  }
  if (count !== task.completedCount) {
    await db.tasks.update(taskId, { completedCount: count })
    await stampWritten("tasks", taskId)
  }
}

/**
 * Applies a run mutation in one transaction. This is what keeps the
 * completedCount invariant safe: a run flipping to done commits together with
 * its activity, counter patch and ledger point — or not at all.
 */
export async function applyRunMutation(m: RunMutation): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.dayRuns,
      db.activities,
      db.tasks,
      db.repeatLedgers,
      db.dismissedTasks,
      db.recordMeta,
    ],
    async () => {
      for (const run of m.putRuns ?? []) {
        await db.dayRuns.put(run)
        await stampWritten("dayRuns", run.id)
      }
      for (const id of m.deleteRunIds ?? []) {
        await db.dayRuns.delete(id)
        await stampDeleted("dayRuns", id)
      }
      for (const activity of m.putActivities ?? []) {
        await db.activities.put(activity)
        await stampWritten("activities", activity.id)
      }
      for (const id of m.deleteActivityIds ?? []) {
        await db.activities.delete(id)
        await stampDeleted("activities", id)
      }
      for (const { taskId, patch } of m.taskPatches ?? []) {
        const count = await db.tasks.update(taskId, patch)
        if (count > 0) await stampWritten("tasks", taskId)
      }
      for (const { taskId, dateKey, status } of m.ledgerMarks ?? []) {
        const count = await db.repeatLedgers.update(taskId, {
          [`points.${dateKey}`]: status,
        })
        if (count > 0) await stampWritten("repeatLedgers", taskId)
      }
      for (const { taskId, dateKey } of m.putDismissals ?? []) {
        await db.dismissedTasks.put({ taskId, dateKey })
        await stampWritten("dismissedTasks", taskId)
      }
      for (const taskId of m.deleteDismissalTaskIds ?? []) {
        await db.dismissedTasks.delete(taskId)
        await stampDeleted("dismissedTasks", taskId)
      }
      for (const id of m.retractDoneRunIds ?? []) {
        const run = await db.dayRuns.get(id)
        if (run?.arrangementStatus !== "done") continue
        await db.dayRuns.put({ ...run, arrangementStatus: "todo" })
        await stampWritten("dayRuns", id)
      }
      // Re-derive completedCount from the records just written (same tx).
      for (const taskId of m.recomputeCompletedCountFor ?? []) {
        await recomputeCompletedCountInTx(taskId)
      }
    }
  )
}

/**
 * Day-boundary sweep for runs: drop every row from an earlier day, except
 * non-repeat allow-cross-day runs still inProgress — those carry over with
 * their dateKey rewritten to today (the caller supplies which ids qualify).
 */
async function sweepDayRunsForCrossDay(
  carryOverRunIds: ReadonlySet<TaskRuntimeID>,
  todayKey: LocalDateKey
): Promise<void> {
  await db.transaction("rw", [db.dayRuns, db.recordMeta], async () => {
    const runs = await db.dayRuns.toArray()
    for (const run of runs) {
      if (run.dateKey >= todayKey) continue
      if (carryOverRunIds.has(run.id)) {
        await db.dayRuns.put({ ...run, dateKey: todayKey })
        await stampWritten("dayRuns", run.id)
      } else {
        await db.dayRuns.delete(run.id)
        await stampDeleted("dayRuns", run.id)
      }
    }
  })
}

/**
 * Runs one replan atomically: snapshot + dayRuns are read, the (pure) planner
 * computes, and the run diff is written — all inside a single rw transaction
 * over every table involved. Overlapping replans serialize on the transaction,
 * so a stale-snapshot replan can never commit over a newer one's output.
 */
export async function applyReplanAtomic<T>(
  compute: (
    snapshot: EntitySnapshot,
    runs: DayRunEntity[]
  ) => {
    putRuns: DayRunEntity[]
    deleteRunIds: TaskRuntimeID[]
    result: T
  }
): Promise<T> {
  return db.transaction(
    "rw",
    [
      db.goals,
      db.tasks,
      db.deps,
      db.goalTriggerStates,
      db.taskTriggerStates,
      db.repeatLedgers,
      db.manualFocuses,
      db.dismissedTasks,
      db.dayRuns,
      db.appMeta,
      db.recordMeta,
    ],
    async () => {
      const [snapshot, runs] = await Promise.all([
        queryEntitySnapshot(),
        db.dayRuns.toArray(),
      ])
      const { putRuns, deleteRunIds, result } = compute(snapshot, runs)
      for (const run of putRuns) {
        await db.dayRuns.put(run)
        await stampWritten("dayRuns", run.id)
      }
      for (const id of deleteRunIds) {
        await db.dayRuns.delete(id)
        await stampDeleted("dayRuns", id)
      }
      return result
    }
  )
}

/**
 * Un-focusing a goal, expressed as data: drop its auto-planned (`default`
 * source, still-todo) runs. Goal focus is derived, and these runs ARE the
 * auto-focus evidence — deleting them is what "remove from focus" means.
 * Manual/forced runs are untouched (they carry their own focus reasons).
 */
export async function deleteAutoRunsForGoal(goalId: GoalID): Promise<void> {
  await db.transaction(
    "rw",
    [db.tasks, db.dayRuns, db.recordMeta],
    async () => {
      const taskIds = (await db.tasks
        .where("goalId")
        .equals(goalId)
        .primaryKeys()) as TaskID[]
      if (taskIds.length === 0) return
      const rows = await db.dayRuns.where("taskId").anyOf(taskIds).toArray()
      for (const row of rows) {
        if (row.source !== "default") continue
        if (row.arrangementStatus !== "todo") continue
        await db.dayRuns.delete(row.id)
        await stampDeleted("dayRuns", row.id)
      }
    }
  )
}

/** Drops every run of the given tasks (task/goal deletion, normalization). */
export async function deleteDayRunsByTasks(taskIds: TaskID[]): Promise<void> {
  if (taskIds.length === 0) return
  await db.transaction("rw", [db.dayRuns, db.recordMeta], async () => {
    const rows = await db.dayRuns.where("taskId").anyOf(taskIds).toArray()
    for (const row of rows) {
      await db.dayRuns.delete(row.id)
      await stampDeleted("dayRuns", row.id)
    }
  })
}

// ── Cascade deletion (whole write-set in ONE transaction) ──

/** Per-task teardown shared by both cascades; runs inside the caller's tx. */
async function deleteTaskRowsCascade(taskIds: TaskID[]): Promise<void> {
  if (taskIds.length === 0) return
  const activityIds = (await db.activities
    .where("taskId")
    .anyOf(taskIds)
    .primaryKeys()) as ActivityID[]
  await db.activities.bulkDelete(activityIds)
  await stampDeletedMany("activities", activityIds)

  const runIds = (await db.dayRuns
    .where("taskId")
    .anyOf(taskIds)
    .primaryKeys()) as TaskRuntimeID[]
  await db.dayRuns.bulkDelete(runIds)
  await stampDeletedMany("dayRuns", runIds)

  for (const taskId of taskIds) {
    if (await db.repeatLedgers.get(taskId)) {
      await db.repeatLedgers.delete(taskId)
      await stampDeleted("repeatLedgers", taskId)
    }
    if (await db.taskTriggerStates.get(taskId)) {
      await db.taskTriggerStates.delete(taskId)
      await stampDeleted("taskTriggerStates", taskId)
    }
    if (await db.dismissedTasks.get(taskId)) {
      await db.dismissedTasks.delete(taskId)
      await stampDeleted("dismissedTasks", taskId)
    }
  }

  await db.tasks.bulkDelete(taskIds)
  await stampDeletedMany("tasks", taskIds)
}

/**
 * Deletes a goal and everything hanging off it — tasks, dependency tree,
 * activities, ledgers, trigger states, runs and day-scoped intent records — in
 * one transaction, so a failure mid-cascade can never leave orphans behind.
 */
export async function deleteGoalCascadeAtomic(goalId: GoalID): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.goals,
      db.tasks,
      db.deps,
      db.activities,
      db.repeatLedgers,
      db.goalTriggerStates,
      db.taskTriggerStates,
      db.dayRuns,
      db.manualFocuses,
      db.dismissedTasks,
      db.recordMeta,
    ],
    async () => {
      const taskIds = (await db.tasks
        .where("goalId")
        .equals(goalId)
        .primaryKeys()) as TaskID[]
      await deleteTaskRowsCascade(taskIds)

      const depIds = (await db.deps
        .where("belongTo")
        .equals(goalId)
        .primaryKeys()) as DependencyEntityID[]
      await db.deps.bulkDelete(depIds)
      await stampDeletedMany("deps", depIds)

      const goalActivityIds = (await db.activities
        .where("goalId")
        .equals(goalId)
        .primaryKeys()) as ActivityID[]
      await db.activities.bulkDelete(goalActivityIds)
      await stampDeletedMany("activities", goalActivityIds)

      if (await db.goalTriggerStates.get(goalId)) {
        await db.goalTriggerStates.delete(goalId)
        await stampDeleted("goalTriggerStates", goalId)
      }
      if (await db.manualFocuses.get(goalId)) {
        await db.manualFocuses.delete(goalId)
        await stampDeleted("manualFocuses", goalId)
      }

      await db.goals.delete(goalId)
      await stampDeleted("goals", goalId)
    }
  )
}

/**
 * Deletes a task with its records (activities, ledger, trigger state, runs,
 * dismissal) and lands the caller-computed dependency-tree rewires in the same
 * transaction.
 */
export async function deleteTaskCascadeAtomic(
  taskId: TaskID,
  depUpdates: DependencyEntity[] = []
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.tasks,
      db.deps,
      db.activities,
      db.repeatLedgers,
      db.taskTriggerStates,
      db.dayRuns,
      db.dismissedTasks,
      db.recordMeta,
    ],
    async () => {
      await deleteTaskRowsCascade([taskId])
      for (const dep of depUpdates) {
        await db.deps.put(dep)
        await stampWritten("deps", dep.id)
      }
    }
  )
}

/**
 * Cross-day carry-over for the intent tables — additive only. Intent records
 * are day-scoped by their `dateKey` and every reader filters to today
 * (`selectTodayDismissedTaskIds` / `deriveManualFocusGoalIds`), so yesterday's
 * records are inert without any deleting: the sweep merely refreshes the focus
 * of goals whose runtime carries over. Writing (never tombstoning) here keeps
 * multi-device day boundaries monotonic — a sweep can no longer race another
 * device's still-yesterday intent writes under LWW. Stale records are GC'd
 * later through the sync channel (`gcStaleIntentRecords`).
 */
async function sweepIntentForCrossDay(
  keptGoalIds: ReadonlySet<GoalID>,
  todayKey: LocalDateKey
): Promise<void> {
  await db.transaction("rw", [db.manualFocuses, db.recordMeta], async () => {
    const focuses = await db.manualFocuses.toArray()
    for (const focus of focuses) {
      if (!keptGoalIds.has(focus.goalId)) continue
      if (focus.dateKey === todayKey && focus.source === "manual") continue
      // Carried over because the goal holds an allowCrossDay run — not
      // because a trigger fired today, so the source resets to "manual".
      // A trigger that DOES fire today re-stamps it right after this sweep
      // (runTriggerResetIfNeeded runs next).
      await db.manualFocuses.put({
        goalId: focus.goalId,
        dateKey: todayKey,
        source: "manual",
      })
      await stampWritten("manualFocuses", focus.goalId)
    }
  })
}

/**
 * Opportunistic GC for expired day-scoped intent records (run on the sync
 * channel, alongside tombstone GC): records whose dateKey fell behind the
 * horizon stopped meaning anything days ago on every device, so deleting them
 * — tombstoned, or a peer's live copy would resurrect them — cannot race any
 * meaningful write.
 */
export async function gcStaleIntentRecords(
  olderThanKey: LocalDateKey
): Promise<number> {
  return db.transaction(
    "rw",
    [db.manualFocuses, db.dismissedTasks, db.recordMeta],
    async () => {
      let removed = 0
      const focuses = await db.manualFocuses.toArray()
      for (const focus of focuses) {
        if (focus.dateKey >= olderThanKey) continue
        await db.manualFocuses.delete(focus.goalId)
        await stampDeleted("manualFocuses", focus.goalId)
        removed++
      }
      const dismissals = await db.dismissedTasks.toArray()
      for (const record of dismissals) {
        if (record.dateKey >= olderThanKey) continue
        await db.dismissedTasks.delete(record.taskId)
        await stampDeleted("dismissedTasks", record.taskId)
        removed++
      }
      return removed
    }
  )
}

/**
 * The whole day-boundary reset in ONE transaction: the intent carry-over and
 * the run rows commit together, so a crash mid-sweep can't leave yesterday's
 * runs alive with today's intent already refreshed. The two inner sweeps open
 * nested transactions over subsets of these tables, which Dexie folds into
 * this parent. Idempotent: a second run over the same day changes nothing.
 */
export async function sweepDayBoundaryAtomic(
  keptGoalIds: ReadonlySet<GoalID>,
  carryOverRunIds: ReadonlySet<TaskRuntimeID>,
  todayKey: LocalDateKey
): Promise<void> {
  await db.transaction(
    "rw",
    [db.manualFocuses, db.dayRuns, db.recordMeta],
    async () => {
      await sweepIntentForCrossDay(keptGoalIds, todayKey)
      await sweepDayRunsForCrossDay(carryOverRunIds, todayKey)
    }
  )
}

/**
 * Converge the local entity tables onto an already-merged snapshot via
 * record-level LWW — NOT clear-and-rewrite. Inside one transaction the current
 * recordMeta sidecar is read and diffed against the merged metadata
 * (`buildApplyPlan`): only records whose merged meta is at least as new as the
 * local meta are written/deleted, and their merged meta is stored verbatim
 * (never re-stamped). Records written locally after the sync's snapshot was
 * taken carry a newer local `updatedAt` and survive untouched, which closes
 * the snapshot→apply window race. The transaction spans all synced tables, so
 * concurrent local writes (their own transactions) serialize against it.
 *
 * The snapshot is expected to be referentially clean (FK repair happens in the
 * pure merge engine). Callers wrap this in `withApplyingRemote` so table hooks
 * don't loop back as local changes.
 */
export async function applyRemoteSnapshot(data: {
  entities: EntitySnapshot
  tags: TagDefinition[]
  activities: ActivityEntity[]
  dayRuns: DayRunEntity[]
  appMeta: AppMetaRow[]
  recordMeta: RecordMetaMap
}): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.goals,
      db.tasks,
      db.deps,
      db.goalTriggerStates,
      db.taskTriggerStates,
      db.tags,
      db.activities,
      db.repeatLedgers,
      db.manualFocuses,
      db.dismissedTasks,
      db.dayRuns,
      // Must list every table in TABLES: the apply loop below writes each one,
      // and a table missing from the scope fails the whole transaction with
      // "object store was not found" — which is what silently broke sync when
      // appMeta joined TABLES.
      db.appMeta,
      db.recordMeta,
    ],
    async () => {
      const localRows = await db.recordMeta.toArray()
      const localMeta: RecordMetaMap = {}
      for (const row of localRows) {
        localMeta[row.key] = {
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
        }
      }

      const plan = buildApplyPlan(
        {
          entities: data.entities,
          tags: data.tags,
          activities: data.activities,
          dayRuns: data.dayRuns,
          appMeta: data.appMeta,
        },
        data.recordMeta,
        localMeta
      )

      for (const table of TABLES) {
        const deletes = plan.deletes[table]
        if (deletes.length > 0) await db.table(table).bulkDelete(deletes)
        const puts = plan.puts[table]
        if (puts.length > 0) await db.table(table).bulkPut(puts)
      }
      if (plan.metaPuts.length > 0) {
        await db.recordMeta.bulkPut(plan.metaPuts)
      }
    }
  )
}

export async function queryActivitiesByTasks(
  taskIds: TaskID[]
): Promise<Map<TaskID, ActivityEntity[]>> {
  const map = new Map<TaskID, ActivityEntity[]>()
  if (taskIds.length === 0) return map
  const results = await db.activities.where("taskId").anyOf(taskIds).toArray()
  for (const a of results) {
    const revived = reviveActivityDates(a)
    const list = map.get(revived.taskId) ?? []
    list.push(revived)
    map.set(revived.taskId, list)
  }
  return map
}

// ── Goal Trigger ──────────────────────────────────────────
export async function setGoalTriggerAtomic(
  goalId: GoalID,
  trigger: GoalTriggerConfig
): Promise<SetGoalTriggerAtomicResult> {
  return db.transaction("rw", [db.goals, db.tasks, db.recordMeta], async () => {
    const goal = await db.goals.get(goalId)
    if (!goal) {
      return "goal-not-found"
    }

    const tasks = await db.tasks.where("goalId").equals(goalId).toArray()
    if (tasks.some((task) => task.repeat != null)) {
      return "repeat-tasks"
    }

    await db.goals.update(goalId, {
      trigger,
      dueAt: undefined,
    })
    await stampWritten("goals", goalId)

    return "saved"
  })
}

/**
 * Enable a goal trigger, first normalizing every task that is not single-run.
 * A violating task (total !== 1, or has a repeat / trigger rule) is reset to a
 * single-run task and its repeat ledger (planning points) and trigger state are
 * deleted — all within one transaction. Returns the normalized task ids so the
 * caller can drop their in-memory runtime entries.
 */
export async function setGoalTriggerWithTaskNormalizationAtomic(
  goalId: GoalID,
  trigger: GoalTriggerConfig
): Promise<SetGoalTriggerWithNormalizationResult> {
  return db.transaction(
    "rw",
    [db.goals, db.tasks, db.repeatLedgers, db.taskTriggerStates, db.recordMeta],
    async () => {
      const goal = await db.goals.get(goalId)
      if (!goal) {
        return { result: "goal-not-found", normalizedTaskIds: [] }
      }

      const tasks = await db.tasks.where("goalId").equals(goalId).toArray()
      const normalizedTaskIds: TaskID[] = []

      for (const task of tasks) {
        const violates =
          task.total !== 1 || task.repeat != null || task.trigger != null
        if (!violates) continue

        await db.tasks.update(task.id, {
          total: 1,
          completedCount: Math.min(task.completedCount, 1),
          repeat: undefined,
          trigger: undefined,
        })
        await db.repeatLedgers.delete(task.id)
        await db.taskTriggerStates.delete(task.id)
        await stampWritten("tasks", task.id)
        await stampDeleted("repeatLedgers", task.id)
        await stampDeleted("taskTriggerStates", task.id)
        normalizedTaskIds.push(task.id)
      }

      await db.goals.update(goalId, {
        trigger,
        dueAt: undefined,
      })
      await stampWritten("goals", goalId)

      return { result: "saved", normalizedTaskIds }
    }
  )
}

/**
 * Move a task to a different goal (or detach it to standalone) atomically.
 *
 * In one transaction it: detaches the task node from the old goal's dependency
 * tree (bridging its children up to all of its parents), rebinds the task's
 * `goalId`, optionally normalizes the task to single-run (clearing repeat/trigger
 * + their ledger/state rows), and re-attaches the task to the new goal's
 * dependency tree as a floating node (start → node → end).
 *
 * When the target goal has no dependency tree yet, a new one is created with
 * `newDependencyId`.
 */
export async function rebindTaskGoalAtomic(params: {
  taskId: TaskID
  toGoalId: GoalID | undefined
  normalize: boolean
  newDependencyId: DependencyEntityID
}): Promise<RebindTaskGoalAtomicResult> {
  const { taskId, toGoalId, normalize, newDependencyId } = params
  return db.transaction(
    "rw",
    [db.tasks, db.deps, db.repeatLedgers, db.taskTriggerStates, db.recordMeta],
    async () => {
      const task = await db.tasks.get(taskId)
      if (!task) {
        return { result: "task-not-found" }
      }

      const fromGoalId = task.goalId

      // 1. Detach from the old goal's dependency tree (bridge children upward).
      if (fromGoalId) {
        const oldDep = await db.deps
          .where("belongTo")
          .equals(fromGoalId)
          .first()
        if (oldDep) {
          const nextTree = removeTaskNodeFromTree(oldDep.tree, taskId)
          await db.deps.update(oldDep.id, { tree: nextTree })
          await stampWritten("deps", oldDep.id)
        }
      }

      // 2. Rebind the task, optionally normalizing to single-run.
      const taskPatch: Partial<TaskGroupEntity> = { goalId: toGoalId }
      if (normalize) {
        taskPatch.total = 1
        taskPatch.completedCount = Math.min(task.completedCount, 1)
        taskPatch.repeat = undefined
        taskPatch.trigger = undefined
      }
      await db.tasks.update(taskId, taskPatch)
      await stampWritten("tasks", taskId)

      if (normalize) {
        await db.repeatLedgers.delete(taskId)
        await db.taskTriggerStates.delete(taskId)
        await stampDeleted("repeatLedgers", taskId)
        await stampDeleted("taskTriggerStates", taskId)
      }

      // 3. Attach to the new goal's dependency tree as a floating node.
      if (toGoalId) {
        const newDep = await db.deps.where("belongTo").equals(toGoalId).first()
        if (newDep) {
          const nextTree = appendFloatingTaskNode(
            newDep.tree,
            taskId,
            task.title
          )
          await db.deps.update(newDep.id, { tree: nextTree })
          await stampWritten("deps", newDep.id)
        } else {
          const created: DependencyEntity = {
            id: newDependencyId,
            belongTo: toGoalId,
            tree: appendFloatingTaskNode([], taskId, task.title),
          }
          await db.deps.put(created)
          await stampWritten("deps", newDependencyId)
        }
      }

      return { result: "saved", normalized: normalize }
    }
  )
}

export async function createGoalWithTriggerAtomic(
  goal: GoalEntity
): Promise<CreateGoalWithTriggerAtomicResult> {
  return db.transaction("rw", [db.goals, db.recordMeta], async () => {
    const existingGoal = await db.goals.get(goal.id)
    if (existingGoal) {
      return "goal-exists"
    }

    await db.goals.put({
      ...goal,
      dueAt: undefined,
    })
    await stampWritten("goals", goal.id)

    return "created"
  })
}

export async function deleteGoalTriggerAtomic(
  goalId: GoalID
): Promise<DeleteGoalTriggerAtomicResult> {
  return db.transaction(
    "rw",
    [db.goals, db.goalTriggerStates, db.recordMeta],
    async () => {
      const goal = await db.goals.get(goalId)
      if (!goal) {
        return "goal-not-found"
      }

      await db.goals.update(goalId, {
        trigger: undefined,
        dueAt: undefined,
      })
      await db.goalTriggerStates.delete(goalId)
      await stampWritten("goals", goalId)
      await stampDeleted("goalTriggerStates", goalId)

      return "deleted"
    }
  )
}

export async function deleteGoalTriggerState(goalId: GoalID) {
  await db.transaction(
    "rw",
    [db.goalTriggerStates, db.recordMeta],
    async () => {
      await db.goalTriggerStates.delete(goalId)
      await stampDeleted("goalTriggerStates", goalId)
    }
  )
}

// ── Task Trigger ─────────────────────────────────────────
export async function setTaskTriggerAtomic(
  taskId: TaskID,
  trigger: TaskTriggerConfig
): Promise<SetTaskTriggerAtomicResult> {
  return db.transaction("rw", [db.tasks, db.recordMeta], async () => {
    const task = await db.tasks.get(taskId)
    if (!task) {
      return "task-not-found"
    }

    if (task.repeat != null) {
      return "repeat-task"
    }

    // Trigger tasks enter the plan via triggerPolicy only; a due date would
    // open a competing duePolicy path, so it is cleared on enable.
    await db.tasks.update(taskId, { trigger, dueAt: undefined })
    await stampWritten("tasks", taskId)

    return "saved"
  })
}

export async function deleteTaskTriggerAtomic(
  taskId: TaskID
): Promise<DeleteTaskTriggerAtomicResult> {
  return db.transaction(
    "rw",
    [db.tasks, db.taskTriggerStates, db.recordMeta],
    async () => {
      const task = await db.tasks.get(taskId)
      if (!task) {
        return "task-not-found"
      }

      await db.tasks.update(taskId, { trigger: undefined })
      await db.taskTriggerStates.delete(taskId)
      await stampWritten("tasks", taskId)
      await stampDeleted("taskTriggerStates", taskId)

      return "deleted"
    }
  )
}

export async function deleteTaskTriggerState(taskId: TaskID) {
  await db.transaction(
    "rw",
    [db.taskTriggerStates, db.recordMeta],
    async () => {
      await db.taskTriggerStates.delete(taskId)
      await stampDeleted("taskTriggerStates", taskId)
    }
  )
}

export async function applyTaskTriggerResetAtomic(
  resets: Array<{
    taskId: TaskID
    lastTriggeredDateKey: LocalDateKey
  }>
): Promise<void> {
  await db.transaction(
    "rw",
    [db.tasks, db.taskTriggerStates, db.recordMeta],
    async () => {
      for (const reset of resets) {
        // The reset list was evaluated from an earlier snapshot; a task
        // deleted since then must not get its trigger state recreated — the
        // live stamp would outlive the task's tombstone in the sync merge.
        if ((await db.tasks.get(reset.taskId)) == null) continue
        await db.taskTriggerStates.put({
          taskId: reset.taskId,
          lastTriggeredDateKey: reset.lastTriggeredDateKey,
        })
        await stampWritten("taskTriggerStates", reset.taskId)
      }
    }
  )
}

// ── RepeatLedger ──────────────────────────────────────────
export async function queryAllRepeatLedgers(): Promise<RepeatLedgerEntity[]> {
  return db.repeatLedgers.toArray()
}

export async function queryRepeatLedger(
  taskId: TaskID
): Promise<RepeatLedgerEntity | null> {
  return (await db.repeatLedgers.get(taskId)) ?? null
}

export async function putRepeatLedger(ledger: RepeatLedgerEntity) {
  return db.transaction("rw", [db.repeatLedgers, db.recordMeta], async () => {
    const result = await db.repeatLedgers.put(ledger)
    await stampWritten("repeatLedgers", ledger.taskId)
    return result
  })
}

export async function deleteRepeatLedger(taskId: TaskID) {
  await db.transaction("rw", [db.repeatLedgers, db.recordMeta], async () => {
    await db.repeatLedgers.delete(taskId)
    await stampDeleted("repeatLedgers", taskId)
  })
}

export async function markRepeatPoint(
  taskId: TaskID,
  dateKey: LocalDateKey,
  status: RepeatPointStatus
) {
  return db.transaction("rw", [db.repeatLedgers, db.recordMeta], async () => {
    const count = await db.repeatLedgers.update(taskId, {
      [`points.${dateKey}`]: status,
    })
    if (count > 0) await stampWritten("repeatLedgers", taskId)
    return count
  })
}

export async function applyTriggerResetAtomic(
  resets: Array<{
    goalId: GoalID
    /** Due stamped on the goal for this round; undefined clears any prior one. */
    dueAt: Date | undefined
    lastTriggeredDateKey: LocalDateKey
  }>
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.goals,
      db.tasks,
      db.activities,
      db.repeatLedgers,
      db.goalTriggerStates,
      db.manualFocuses,
      db.recordMeta,
    ],
    async () => {
      for (const reset of resets) {
        // The reset was evaluated from an earlier snapshot; a goal deleted
        // since then must not be re-stamped — the live stamp would outlive
        // its tombstone in the sync merge and resurrect the goal.
        if ((await db.goals.get(reset.goalId)) == null) continue

        // The tasks to reset are derived HERE, inside the transaction, never
        // taken from the caller: only tasks currently under the goal.
        const goalTaskIds = (
          await db.tasks.where("goalId").equals(reset.goalId).toArray()
        ).map((task) => task.id)

        await Promise.all([
          db.goals.update(reset.goalId, { dueAt: reset.dueAt }),
          db.goalTriggerStates.put({
            goalId: reset.goalId,
            lastTriggeredDateKey: reset.lastTriggeredDateKey,
          }),
          // Firing pulls the goal into today's focus by RECORDING it, in the
          // same transaction as the fire itself. A trigger fires once per day
          // (getPendingTriggerDateKey stops at lastTriggeredDateKey === today),
          // so this writes once and the user stays free to un-focus afterwards
          // — replan only reads the record, it never re-derives the pull-up.
          db.manualFocuses.put({
            goalId: reset.goalId,
            dateKey: reset.lastTriggeredDateKey,
            source: "trigger",
          }),
        ])
        await stampWritten("goals", reset.goalId)
        await stampWritten("goalTriggerStates", reset.goalId)
        await stampWritten("manualFocuses", reset.goalId)

        // A fired goal trigger starts a NEW round for its tasks, so the
        // previous rounds' completion records are dropped and the counter is
        // re-derived from what is left — rather than blanket-zeroed, which
        // contradicted the projection and let any later recompute resurrect an
        // old round's count. Only records dated BEFORE this round go: a record
        // already carrying this round's dateKey belongs to it (another device
        // may have completed the task before this one got round to firing), and
        // deleting by wall clock instead of by date would silently swallow it.
        for (const taskId of goalTaskIds) {
          const staleActivityIds = (
            await db.activities.where("taskId").equals(taskId).toArray()
          )
            .filter(
              (activity) =>
                activity.kind === "task-done" &&
                activity.recordedDateKey < reset.lastTriggeredDateKey
            )
            .map((activity) => activity.id)

          if (staleActivityIds.length > 0) {
            await db.activities.bulkDelete(staleActivityIds)
            await stampDeletedMany("activities", staleActivityIds)
          }
          await recomputeCompletedCountInTx(taskId)
        }
      }
    }
  )
}

/**
 * Drops the fired tasks' runs, with the same carry-over exception the day
 * boundary honours (see `selectCrossDayCarryOver`): a non-repeat task that opted
 * into `allowCrossDay` and is still `inProgress` keeps its run across the fire.
 * Every dropped run also takes its `task-in-progress` activity with it —
 * otherwise the activity stream keeps showing a run that no longer exists.
 */
async function deleteDayRunsForTriggerReset(taskIds: TaskID[]): Promise<void> {
  if (taskIds.length === 0) return

  const runs = await db.dayRuns.where("taskId").anyOf(taskIds).toArray()
  if (runs.length === 0) return

  const tasks = (await db.tasks.bulkGet(taskIds)).filter(
    (task): task is TaskGroupEntity => task != null
  )
  const { taskRuntime: carryOverRuns } = selectCrossDayCarryOver({
    tasks,
    taskRuntime: Object.fromEntries(runs.map((run) => [run.id, run])),
  })

  for (const run of runs) {
    if (carryOverRuns[run.id]) continue

    await db.dayRuns.delete(run.id)
    await stampDeleted("dayRuns", run.id)

    const inProgressActivityId = createStableActivityId(
      "task-in-progress",
      run.id
    )
    if ((await db.activities.get(inProgressActivityId)) != null) {
      await db.activities.delete(inProgressActivityId)
      await stampDeleted("activities", inProgressActivityId)
    }
  }
}

/**
 * One day's trigger fires — goal resets, task resets and the stale-run cleanup
 * they imply — committed as ONE transaction. The three inner helpers open
 * nested transactions over subsets of these tables, which Dexie folds into
 * this parent, so a crash between them can no longer strand a fired trigger
 * with yesterday's runs still alive.
 */
export async function applyDailyTriggerResetsAtomic(params: {
  goalResets: Parameters<typeof applyTriggerResetAtomic>[0]
  taskResets: Parameters<typeof applyTaskTriggerResetAtomic>[0]
  resetTaskIds: TaskID[]
}): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.goals,
      db.tasks,
      db.activities,
      db.repeatLedgers,
      db.goalTriggerStates,
      db.taskTriggerStates,
      db.manualFocuses,
      db.dayRuns,
      db.recordMeta,
    ],
    async () => {
      if (params.goalResets.length > 0) {
        await applyTriggerResetAtomic(params.goalResets)
      }
      if (params.taskResets.length > 0) {
        await applyTaskTriggerResetAtomic(params.taskResets)
      }
      await deleteDayRunsForTriggerReset(params.resetTaskIds)
    }
  )
}

// MARK: - Sync read cache (persisted etag + snapshot per remote device file)

export async function querySyncReadCache(
  providerKind: string
): Promise<SyncReadCacheRow[]> {
  return db.syncReadCache.where("providerKind").equals(providerKind).toArray()
}

/** Replace this provider's cached rows wholesale (mirrors the in-memory map). */
export async function replaceSyncReadCache(
  providerKind: string,
  rows: SyncReadCacheRow[]
): Promise<void> {
  await db.transaction("rw", db.syncReadCache, async () => {
    await db.syncReadCache.where("providerKind").equals(providerKind).delete()
    if (rows.length > 0) {
      await db.syncReadCache.bulkAdd(rows)
    }
  })
}

export async function clearSyncReadCache(providerKind: string): Promise<void> {
  await db.syncReadCache.where("providerKind").equals(providerKind).delete()
}
