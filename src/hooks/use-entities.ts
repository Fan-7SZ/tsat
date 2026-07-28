import { useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { DismissedTaskRecord } from "@/domain/entities/IntentRecord"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  DependencyEntityID,
  GoalID,
  TaskID,
} from "@/domain/value-objects/types"
import {
  queryAllDeps,
  queryAllDismissedTasks,
  queryAllGoals,
  queryAllRepeatLedgers,
  queryAllTasks,
  queryDependencyByGoal,
  queryGoalById,
  queryTaskById,
  queryTasksByGoal,
} from "@/persistence/repository"
import { toLocalDateKey } from "@/utils/date"
import { selectTodayDismissedTaskIds } from "@/utils/dismissed-tasks"

// This file provides hooks to query entities from the database and transform them into different shapes for consumption in the UI layer.
// It also handles the live update of data when the underlying database changes.

export type GoalDetailSource = {
  goal: GoalEntity | null
  tasks: TaskGroupEntity[]
  dependencyTree: DependencyEntity | null
}

export type TaskDetailSource = {
  task: TaskGroupEntity | null
  goal: GoalEntity | null
  goalTasks: TaskGroupEntity[]
  dependencyTree: DependencyEntity | null
}

const EMPTY_GOAL_DETAIL_SOURCE: GoalDetailSource = {
  goal: null,
  tasks: [],
  dependencyTree: null,
}

const EMPTY_TASK_DETAIL_SOURCE: TaskDetailSource = {
  task: null,
  goal: null,
  goalTasks: [],
  dependencyTree: null,
}

function buildGoalRecord(goals: GoalEntity[]): Record<GoalID, GoalEntity> {
  return Object.fromEntries(goals.map((goal) => [goal.id, goal])) as Record<
    GoalID,
    GoalEntity
  >
}

function buildTaskRecord(
  tasks: TaskGroupEntity[]
): Record<TaskID, TaskGroupEntity> {
  return Object.fromEntries(tasks.map((task) => [task.id, task])) as Record<
    TaskID,
    TaskGroupEntity
  >
}

function buildDependencyRecord(
  deps: DependencyEntity[]
): Record<DependencyEntityID, DependencyEntity> {
  return Object.fromEntries(deps.map((dep) => [dep.id, dep])) as Record<
    DependencyEntityID,
    DependencyEntity
  >
}

function buildRepeatLedgerRecord(
  ledgers: RepeatLedgerEntity[]
): Record<TaskID, RepeatLedgerEntity> {
  return Object.fromEntries(
    ledgers.map((ledger) => [ledger.taskId, ledger])
  ) as Record<TaskID, RepeatLedgerEntity>
}

export type GoalTaskHierarchyGroup = {
  goal: GoalEntity
  // A goal might have multiple task groups or zero task group
  tasks: TaskGroupEntity[]
}

export type GoalTaskHierarchy = {
  goalGroups: GoalTaskHierarchyGroup[]
  standaloneTasks: TaskGroupEntity[]
}

// The optional `initial` parameters below carry a route-loader snapshot that
// covers the frame(s) before each live query first resolves — callers with a
// loader never render against empty data (see src/router/loaders.ts).

export function useAllGoals(initial?: GoalEntity[]): GoalEntity[] {
  return useLiveQuery(() => queryAllGoals(), []) ?? initial ?? []
}

export function useAllTasks(initial?: TaskGroupEntity[]): TaskGroupEntity[] {
  return useLiveQuery(() => queryAllTasks(), []) ?? initial ?? []
}

export function useAllDeps(): DependencyEntity[] {
  return useLiveQuery(() => queryAllDeps(), []) ?? []
}

export function useAllRepeatLedgers(
  initial?: RepeatLedgerEntity[]
): RepeatLedgerEntity[] {
  return useLiveQuery(() => queryAllRepeatLedgers(), []) ?? initial ?? []
}

export function useDeps(): Record<DependencyEntityID, DependencyEntity> {
  const deps = useAllDeps()

  return useMemo(() => buildDependencyRecord(deps), [deps])
}

export function useGoalMap(initial?: GoalEntity[]): Record<GoalID, GoalEntity> {
  const goals = useAllGoals(initial)
  return useMemo(() => buildGoalRecord(goals), [goals])
}

export function useTaskMap(
  initial?: TaskGroupEntity[]
): Record<TaskID, TaskGroupEntity> {
  const tasks = useAllTasks(initial)
  return useMemo(() => buildTaskRecord(tasks), [tasks])
}

export function useRepeatLedgerMap(
  initial?: RepeatLedgerEntity[]
): Record<TaskID, RepeatLedgerEntity> {
  const ledgers = useAllRepeatLedgers(initial)
  return useMemo(() => buildRepeatLedgerRecord(ledgers), [ledgers])
}

/**
 * Tasks the user removed from TODAY's plan. The record is day-scoped (the day
 * sweep clears it), so this is exactly "excluded from today" — tomorrow the task
 * schedules normally again. Records from an earlier day are filtered out
 * defensively in case a sweep has not run yet.
 */
export function useDismissedTaskIds(
  initial?: DismissedTaskRecord[]
): Set<TaskID> {
  const records = useLiveQuery(() => queryAllDismissedTasks(), [])
  return useMemo(() => {
    const rows = records ?? initial ?? []
    return selectTodayDismissedTaskIds(rows, toLocalDateKey(new Date()))
  }, [records, initial])
}

/** First-frame snapshot for the sidebar, prefetched by the main layout loader. */
export type GoalTaskHierarchySource = {
  goals: GoalEntity[]
  tasks: TaskGroupEntity[]
}

export async function fetchGoalTaskHierarchySource(): Promise<GoalTaskHierarchySource> {
  const [goals, tasks] = await Promise.all([queryAllGoals(), queryAllTasks()])
  return { goals, tasks }
}

export function useGoalTaskHierarchy(
  /**
   * Route-loader snapshot used for the frame(s) before the live queries first
   * resolve, so the sidebar renders its groups against real data from the very
   * first paint instead of reflowing when the hierarchy lands.
   */
  initial?: GoalTaskHierarchySource
): GoalTaskHierarchy {
  const goalsResult = useLiveQuery(() => queryAllGoals(), [])
  const tasksResult = useLiveQuery(() => queryAllTasks(), [])

  return useMemo(() => {
    const goals = goalsResult ?? initial?.goals ?? []
    const tasks = tasksResult ?? initial?.tasks ?? []
    const goalIds = new Set(goals.map((goal) => goal.id))
    const tasksByGoal = new Map<GoalID, TaskGroupEntity[]>()
    const standaloneTasks: TaskGroupEntity[] = []

    for (const task of tasks) {
      if (!task.goalId || !goalIds.has(task.goalId)) {
        standaloneTasks.push(task)
        continue
      }

      const goalTasks = tasksByGoal.get(task.goalId) ?? []
      goalTasks.push(task)
      tasksByGoal.set(task.goalId, goalTasks)
    }

    return {
      goalGroups: goals.map((goal) => ({
        goal,
        tasks: tasksByGoal.get(goal.id) ?? [],
      })),
      standaloneTasks,
    }
  }, [goalsResult, tasksResult, initial])
}

/** One-shot fetch of a goal detail's data — shared by the route loader and the live hook. */
export async function fetchGoalDetailSource(
  goalId: GoalID | undefined
): Promise<GoalDetailSource> {
  if (!goalId) {
    return EMPTY_GOAL_DETAIL_SOURCE
  }

  const [goal, tasks, dependencyTree] = await Promise.all([
    queryGoalById(goalId),
    queryTasksByGoal(goalId),
    queryDependencyByGoal(goalId),
  ])

  return {
    goal,
    tasks,
    dependencyTree,
  }
}

/** One-shot fetch of a task detail's data — shared by the route loader and the live hook. */
export async function fetchTaskDetailSource(
  taskId: TaskID | undefined
): Promise<TaskDetailSource> {
  if (!taskId) {
    return EMPTY_TASK_DETAIL_SOURCE
  }

  const task = await queryTaskById(taskId)
  if (!task) {
    return EMPTY_TASK_DETAIL_SOURCE
  }

  if (!task.goalId) {
    return {
      task,
      goal: null,
      goalTasks: [task],
      dependencyTree: null,
    }
  }

  const [goal, goalTasks, dependencyTree] = await Promise.all([
    queryGoalById(task.goalId),
    queryTasksByGoal(task.goalId),
    queryDependencyByGoal(task.goalId),
  ])

  return {
    task,
    goal,
    goalTasks: goalTasks.some((goalTask) => goalTask.id === task.id)
      ? goalTasks
      : [task, ...goalTasks],
    dependencyTree,
  }
}

export function useGoalDetailSource(
  goalId: GoalID | undefined,
  /** Route-loader data covering the pre-first-resolution frame and stale-id frames. */
  initial?: GoalDetailSource
): GoalDetailSource | undefined {
  const live = useLiveQuery(() => fetchGoalDetailSource(goalId), [goalId])
  // First resolution pending → loader data (undefined without a loader, as before).
  if (live === undefined) return initial
  // useLiveQuery keeps the previous id's result for a frame after `goalId`
  // changes; the loader already has the right data, so prefer it. A live result
  // whose goal is null (deleted while viewing) must pass through as-is.
  if (initial && live.goal && live.goal.id !== goalId) return initial
  return live
}

export function useTaskDetailSource(
  taskId: TaskID | undefined,
  /** Route-loader data covering the pre-first-resolution frame and stale-id frames. */
  initial?: TaskDetailSource
): TaskDetailSource | undefined {
  const live = useLiveQuery(() => fetchTaskDetailSource(taskId), [taskId])
  if (live === undefined) return initial
  if (initial && live.task && live.task.id !== taskId) return initial
  return live
}
