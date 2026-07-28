import { useMemo } from "react"

import { useAppStore } from "@/store/app-store"
import {
  EMPTY_DAY_RUN_MAP,
  fetchDayRunRows,
  useDayRunMap,
} from "@/hooks/use-day-runs"
import { fetchManualFocusRows, useGoalFocusMap } from "@/hooks/use-goal-focus"
import { useRunStartDates } from "@/hooks/use-activities"
import {
  queryAllActivities,
  queryAllDismissedTasks,
  queryAllGoals,
  queryAllRepeatLedgers,
  queryAllTasks,
  queryRecentActivities,
} from "@/persistence/repository"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type {
  DismissedTaskRecord,
  ManualFocusRecord,
} from "@/domain/entities/IntentRecord"
import {
  useGoalDetailSource,
  useGoalMap,
  useDismissedTaskIds,
  useRepeatLedgerMap,
  useTaskDetailSource,
  useTaskMap,
  type GoalDetailSource,
  type TaskDetailSource,
} from "@/hooks/use-entities"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import { buildAllTasksPageVM } from "@/store/pages/build-all-tasks-page-vm"
import { buildGoalDetailPageVM } from "@/store/pages/build-goal-detail-page-vm"
import {
  buildHomePageVM,
  type HomePageSource,
} from "@/store/pages/build-home-page-vm"
import { buildMyGoalsPageVM } from "@/store/pages/build-my-goals-page-vm"
import { buildTaskDetailPageVM } from "@/store/pages/build-task-detail-page-vm"
import {
  buildTasksPageVM,
  type TasksPageSource,
} from "@/store/pages/build-tasks-page-vm"
import { useLanguage } from "@/components/shared/language-provider"
import type { GoalID, TaskID } from "@/domain/value-objects/types"

// This file contains hooks that build the view models for each page.
// The purpose of these hooks is to encapsulate the logic of transforming raw data
// from the store into the specific shape needed by each page, and to memoize
// the result for performance optimization.

/**
 * Route-loader snapshot of every global source the list pages (Home / Tasks /
 * AllTasks / MyGoals) render from. Each page's loader fetches this before the
 * navigation commits, so a page never mounts against empty live queries and
 * then pops in — pass it to the page's VM hook as `initial`.
 */
export type ListPagesSnapshot = {
  goals: GoalEntity[]
  tasks: TaskGroupEntity[]
  dayRuns: DayRunEntity[]
  repeatLedgers: RepeatLedgerEntity[]
  activities: ActivityEntity[]
  recentActivities: ActivityEntity[]
  dismissedTasks: DismissedTaskRecord[]
  manualFocuses: ManualFocusRecord[]
}

/** One-shot fetch of the snapshot — shared by the route loader and story stubs. */
export async function fetchListPagesSnapshot(): Promise<ListPagesSnapshot> {
  const [
    goals,
    tasks,
    dayRuns,
    repeatLedgers,
    activities,
    recentActivities,
    dismissedTasks,
    manualFocuses,
  ] = await Promise.all([
    queryAllGoals(),
    queryAllTasks(),
    fetchDayRunRows(),
    queryAllRepeatLedgers(),
    queryAllActivities(),
    queryRecentActivities(10),
    queryAllDismissedTasks(),
    fetchManualFocusRows(),
  ])
  return {
    goals,
    tasks,
    dayRuns,
    repeatLedgers,
    activities,
    recentActivities,
    dismissedTasks,
    manualFocuses,
  }
}

export function useHomePageVM(initial?: ListPagesSnapshot) {
  // Hydrate dexie data and zustand store data (runtime)
  const goals = useGoalMap(initial?.goals)
  const tasks = useTaskMap(initial?.tasks)
  const goalFocus = useGoalFocusMap(initial)
  const taskRuntime = useDayRunMap(initial?.dayRuns) ?? EMPTY_DAY_RUN_MAP
  const repeatLedger = useRepeatLedgerMap(initial?.repeatLedgers)
  const runStartDates = useRunStartDates(initial?.activities)
  const dismissedTaskIds = useDismissedTaskIds(initial?.dismissedTasks)
  const policy = useAppStore((state) => state.policy)
  const { t } = useLanguage()

  return useMemo(
    () =>
      buildHomePageVM({
        goals,
        goalFocus,
        tasks,
        taskRuntime,
        repeatLedger,
        runStartDates,
        dismissedTaskIds,
        policy,
        t,
      } satisfies HomePageSource),
    [
      goals,
      goalFocus,
      tasks,
      taskRuntime,
      repeatLedger,
      runStartDates,
      dismissedTaskIds,
      policy,
      t,
    ]
  )
}

export function useTasksPageVM(initial?: ListPagesSnapshot) {
  const goals = useGoalMap(initial?.goals)
  const tasks = useTaskMap(initial?.tasks)
  const taskRuntime = useDayRunMap(initial?.dayRuns) ?? EMPTY_DAY_RUN_MAP
  const repeatLedger = useRepeatLedgerMap(initial?.repeatLedgers)
  const runStartDates = useRunStartDates(initial?.activities)
  const dismissedTaskIds = useDismissedTaskIds(initial?.dismissedTasks)
  const policy = useAppStore((state) => state.policy)
  const { t } = useLanguage()

  return useMemo(
    () =>
      buildTasksPageVM({
        goals,
        tasks,
        taskRuntime,
        repeatLedger,
        runStartDates,
        dismissedTaskIds,
        policy,
        t,
      } satisfies TasksPageSource),
    [
      goals,
      tasks,
      taskRuntime,
      repeatLedger,
      runStartDates,
      dismissedTaskIds,
      policy,
      t,
    ]
  )
}

export function useMyGoalsPageVM(initial?: ListPagesSnapshot) {
  const goals = useGoalMap(initial?.goals)
  const tasks = useTaskMap(initial?.tasks)
  const goalFocus = useGoalFocusMap(initial)
  const policy = useAppStore((state) => state.policy)

  return useMemo(
    () =>
      buildMyGoalsPageVM({
        goals,
        tasks,
        goalFocus,
        maxFocusGoals: policy.maxFocusGoals,
      }),
    [goals, tasks, goalFocus, policy.maxFocusGoals]
  )
}

export function useAllTasksPageVM(initial?: ListPagesSnapshot) {
  const goals = useGoalMap(initial?.goals)
  const tasks = useTaskMap(initial?.tasks)
  const taskRuntime = useDayRunMap(initial?.dayRuns) ?? EMPTY_DAY_RUN_MAP

  return useMemo(
    () =>
      buildAllTasksPageVM({
        goals,
        tasks,
        taskRuntime,
      }),
    [goals, tasks, taskRuntime]
  )
}

export function useGoalDetailPageVM(
  goalId: GoalID | undefined,
  /** Route-loader data: makes the very first frame render with real content. */
  initialSource?: GoalDetailSource
) {
  const source = useGoalDetailSource(goalId, initialSource)
  const vm = useMemo(
    () =>
      source?.goal
        ? buildGoalDetailPageVM({
            goal: source.goal,
            tasks: source.tasks,
            dependencyTree: source.dependencyTree,
          })
        : null,
    [source]
  )

  return { vm }
}

export function useTaskDetailPageVM(
  taskId: TaskID | undefined,
  /** Route-loader data: makes the very first frame render with real content. */
  initial?: { source: TaskDetailSource; dayRuns: DayRunEntity[] }
) {
  const source = useTaskDetailSource(taskId, initial?.source)
  const taskRuntime = useDayRunMap(initial?.dayRuns) ?? EMPTY_DAY_RUN_MAP
  const dismissedTaskIds = useDismissedTaskIds()
  const vm = useMemo(
    () =>
      source?.task
        ? buildTaskDetailPageVM({
            task: source.task,
            goal: source.goal,
            taskRuntime,
            dismissedTaskIds,
          })
        : null,
    [source, taskRuntime, dismissedTaskIds]
  )

  return {
    vm,
    goalForTask: source?.goal ?? null,
    goalTasks: source?.goalTasks ?? [],
    dependencyForTask: source?.dependencyTree ?? null,
  }
}
