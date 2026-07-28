import { format } from "date-fns"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { GoalFocus } from "@/domain/derived/GoalFocus"
import type {
  HomePageVM,
  HomeTaskItemVM,
  FocusQuotaVM,
} from "@/domain/view-models/HomePageVM"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { PlannerPolicy } from "@/services/planner/types"
import type { Dictionary } from "@/i18n/types"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import {
  hasBlockingGoalFocusStatus,
  normalizeGoalFocus,
} from "@/utils/goal-focus-status"
import { isForcedRuntime, canAddRunToday } from "@/utils/task-runtime"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { isGoalDone } from "@/utils/goal-done"
import { parseDateKey, toLocalDateKey } from "@/utils/date"
import { computePressureByDay } from "@/utils/planning-pressure"
import {
  ordinaliseOpenItems,
  collapseDoneItems,
} from "@/store/pages/collapse-day-items"

/** Forecast length for the planning-pressure panel. */
const PRESSURE_FORECAST_DAYS = 14

// structure of home page vm
export type HomePageSource = {
  goals: Record<GoalID, GoalEntity>
  goalFocus: Record<GoalID, GoalFocus>
  tasks: Record<TaskID, TaskGroupEntity>
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
  repeatLedger: Record<TaskID, RepeatLedgerEntity>
  /** Day each in-progress run was started; derived from its activity record. */
  runStartDates: Record<TaskRuntimeID, LocalDateKey>
  /** Tasks the user removed from today's plan (day-scoped). */
  dismissedTaskIds: ReadonlySet<TaskID>
  policy: PlannerPolicy
  t: Dictionary
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return "Good night!"
  if (hour < 12) return "Good morning!"
  if (hour < 18) return "Good afternoon!"
  return "Good evening!"
}

function sortTaskItems(items: HomeTaskItemVM[]): HomeTaskItemVM[] {
  return [...items].sort((left, right) => {
    const leftTime = left.plannedForDate
      ? parseDateKey(left.plannedForDate).getTime()
      : (left.dueAtRaw?.getTime() ?? Number.POSITIVE_INFINITY)
    const rightTime = right.plannedForDate
      ? parseDateKey(right.plannedForDate).getTime()
      : (right.dueAtRaw?.getTime() ?? Number.POSITIVE_INFINITY)

    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }

    const titleCompare = left.title.localeCompare(right.title)
    if (titleCompare !== 0) {
      return titleCompare
    }

    return left.runtimeId.localeCompare(right.runtimeId)
  })
}

function toTaskPreview(
  source: HomePageSource,
  runtime: TaskRuntimeEntity,
  todayKey: string
): HomeTaskItemVM {
  const task = source.tasks[runtime.taskId]!
  const isRepeat = runtime.source === "repeatPolicy"
  const plannedForDate = isRepeat ? runtime.plannedForDate : undefined
  const isDebtItem =
    isRepeat && plannedForDate != null && plannedForDate < todayKey
  const completed = new Set(runtime.stepsCompleted ?? [])
  const startedOn = source.runStartDates[runtime.id]

  return {
    runtimeId: runtime.id,
    taskId: task.id,
    title: task.title,
    goalId: task.goalId ?? undefined,
    goalTitle: task.goalId ? source.goals[task.goalId]?.title : undefined,
    bucket: runtime.arrangementStatus,
    runtimeStatus: runtime.arrangementStatus,
    runtimeSource: runtime.source,
    steps:
      task.steps?.map((s) => ({
        id: s.id,
        title: s.title,
        done: completed.has(s.id),
      })) ?? [],
    dueAt: task.dueAt ? format(task.dueAt, "PP HH:mm") : undefined,
    dueAtRaw: task.dueAt ?? undefined,
    estimatedDuration: task.estimatedDuration,
    isForced: isForcedRuntime(runtime),
    // Which due forced it in: the task's own under duePolicy, the goal's under
    // goalDuePolicy. Drives the non-dismissible affordance.
    forcedDueAt:
      runtime.source === "duePolicy"
        ? (task.dueAt ?? undefined)
        : runtime.source === "goalDuePolicy"
          ? task.goalId
            ? source.goals[task.goalId]?.dueAt
            : undefined
          : undefined,
    isRepeatTask: task.repeat != null,
    plannedForDate,
    plannedForLabel: plannedForDate
      ? source.t.tasks.planOn(format(parseDateKey(plannedForDate), "MMM d"))
      : undefined,
    isDebtItem,
    canRunAgain: canAddRunToday(task, source.taskRuntime),
    // Only in-progress runs can survive the day boundary (and only on tasks that
    // opted into allowCrossDay), so this is the one place a run can predate today.
    carriedOverLabel:
      runtime.arrangementStatus === "inProgress" &&
      startedOn != null &&
      startedOn < todayKey
        ? source.t.actions.carriedOver(format(parseDateKey(startedOn), "MMM d"))
        : undefined,
  }
}

export function buildHomePageVM(source: HomePageSource): HomePageVM {
  const todayKey = toLocalDateKey(new Date())
  const todayItems = sortTaskItems(
    Object.values(source.taskRuntime)
      .filter((runtime) => source.tasks[runtime.taskId] != null)
      .map((runtime) => toTaskPreview(source, runtime, todayKey))
  )

  const availableFocusGoals = Object.values(source.goals).filter(
    (goal) => !isGoalDone(goal.id, source.tasks)
  )

  const { t, taskRuntime } = source
  const todoTasks = ordinaliseOpenItems(
    todayItems.filter((task) => task.runtimeStatus === "todo"),
    t
  )
  const inProgressTasks = ordinaliseOpenItems(
    todayItems.filter((task) => task.runtimeStatus === "inProgress"),
    t
  )
  const doneTasks = collapseDoneItems(
    todayItems.filter((task) => task.runtimeStatus === "done"),
    taskRuntime,
    t
  )
  const usedMinutes = todayItems.reduce(
    (sum, task) => sum + (task.estimatedDuration ?? 0),
    0
  )

  const pressureByDay = computePressureByDay({
    tasks: source.tasks,
    goals: source.goals,
    repeatLedger: source.repeatLedger,
    now: new Date(),
    days: PRESSURE_FORECAST_DAYS,
  })

  const vm: HomePageVM = {
    greetingTitle: getGreeting(),
    dateLabel: format(new Date(), "yyyy-MM-dd"),
    todayTasks: {
      todo: todoTasks,
      inProgress: inProgressTasks,
      done: doneTasks,
    },
    timeQuota: {
      usedMinutes,
      dailyCapacityMinutes: source.policy.dailyCapacityMinutes,
    },
    focusQuota: undefined as unknown as FocusQuotaVM,
    pressureByDay,
    todayFocus: availableFocusGoals.map((goal) => {
      const tasks = Object.values(source.tasks).filter(
        (task) => task.goalId === goal.id
      )
      const completedCount = tasks.reduce(
        (sum, task) => sum + task.completedCount,
        0
      )
      const totalCount = tasks.reduce((sum, task) => sum + task.total, 0)
      const progressPercent =
        totalCount === 0
          ? 0
          : Math.min(100, Math.round((completedCount / totalCount) * 100))

      const goalFocus = normalizeGoalFocus(goal.id, source.goalFocus[goal.id])
      const focusStatuses = goalFocus.focusStatuses

      // Every unfinished task removed from today ⇒ focusing this goal can
      // surface nothing (the fill layer and trigger re-derivation both skip
      // dismissed tasks), so the toggle would just flip with no visible effect.
      const openTasks = tasks.filter(
        (task) => task.completedCount < task.total
      )
      const allTasksDismissed =
        openTasks.length > 0 &&
        openTasks.every((task) => source.dismissedTaskIds.has(task.id))

      return {
        goal,
        progressPercent,
        isAdded: goalFocus.isFocused || focusStatuses.length > 0,
        dueLabel: goal.dueAt ? format(goal.dueAt, "PP") : undefined,
        isForced: hasBlockingGoalFocusStatus(focusStatuses),
        focusStatuses,
        allTasksDismissed,
      }
    }),
  }

  let focusedCount = 0
  let forcedFocusedCount = 0
  for (const item of vm.todayFocus) {
    if (item.isAdded) {
      focusedCount += 1
      if (item.isForced) {
        forcedFocusedCount += 1
      }
    }
  }

  vm.focusQuota = {
    focusedCount,
    forcedFocusedCount,
    maxFocusGoals: source.policy.maxFocusGoals,
  }

  return vm
}
