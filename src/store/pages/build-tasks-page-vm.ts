import { differenceInCalendarDays, format, startOfDay } from "date-fns"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {
  TasksPageVM,
  TasksTaskItemVM,
} from "@/domain/view-models/TasksPageVM"
import type { PlannerPolicy } from "@/services/planner/types"
import type { Dictionary } from "@/i18n/types"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import { getFuturePoints } from "@/utils/repeat-ledger"
import { summarizeRepeatRule } from "@/utils/rule-summary"
import {
  createTaskRuntimeId,
  hasTaskRuntimeForTask,
  isForcedRuntime,
  canAddRunToday,
} from "@/utils/task-runtime"
import { parseDateKey, toLocalDateKey } from "@/utils/date"
import {
  ordinaliseOpenItems,
  collapseDoneItems,
} from "@/store/pages/collapse-day-items"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

export type TasksPageSource = {
  goals: Record<GoalID, GoalEntity>
  tasks: Record<TaskID, TaskGroupEntity>
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
  repeatLedger: Record<TaskID, RepeatLedgerEntity>
  /** Day each in-progress item was started; derived from its activity record. */
  runStartDates: Record<TaskRuntimeID, LocalDateKey>
  /** Tasks the user removed from today's plan (day-scoped). */
  dismissedTaskIds: ReadonlySet<TaskID>
  policy: PlannerPolicy
  t: Dictionary
}

function formatPlanLabel(
  formatLabel: (dateLabel: string) => string,
  dateKey: LocalDateKey
): string {
  return formatLabel(format(parseDateKey(dateKey), "MMM d"))
}

/**
 * Which due date forced this run into today: the task's own under `duePolicy`,
 * the goal's under `goalDuePolicy`. Any other source is not due-forced.
 */
function resolveForcedDueAt(
  source: TasksPageSource,
  task: TaskGroupEntity,
  runtimeSource: TasksTaskItemVM["runtimeSource"]
): Date | undefined {
  if (runtimeSource === "duePolicy") return task.dueAt ?? undefined
  if (runtimeSource === "goalDuePolicy") {
    return task.goalId ? source.goals[task.goalId]?.dueAt : undefined
  }
  return undefined
}

function toTaskPreview(
  source: TasksPageSource,
  task: TaskGroupEntity,
  options: {
    runtimeId: TaskRuntimeID
    runtimeStatus: TasksTaskItemVM["runtimeStatus"]
    runtimeSource?: TasksTaskItemVM["runtimeSource"]
    plannedForDate?: LocalDateKey
    plannedForLabel?: string
    isForced?: boolean
    isRepeatTask?: boolean
    todayKey?: LocalDateKey
    stepsCompleted?: string[]
    /** Today's runtime, when the item has one; drives the re-run affordance. */
    runtime?: TaskRuntimeEntity
  }
): TasksTaskItemVM {
  const completed = new Set(options.stepsCompleted ?? [])
  const isDebtItem =
    options.runtimeSource === "repeatPolicy" &&
    options.plannedForDate != null &&
    options.todayKey != null &&
    options.plannedForDate < options.todayKey
  // Only an in-progress item can survive the day boundary (allowCrossDay), so
  // this is the one place an item can predate today. See build-home-page-vm.
  const startedOn = options.runtime
    ? source.runStartDates[options.runtime.id]
    : undefined
  const carriedOverLabel =
    options.runtimeStatus === "inProgress" &&
    startedOn != null &&
    options.todayKey != null &&
    startedOn < options.todayKey
      ? source.t.actions.carriedOver(format(parseDateKey(startedOn), "MMM d"))
      : undefined

  return {
    runtimeId: options.runtimeId,
    taskId: task.id,
    title: task.title,
    goalId: task.goalId ?? undefined,
    goalTitle: task.goalId ? source.goals[task.goalId]?.title : undefined,
    bucket: options.runtimeStatus ?? "todo",
    runtimeStatus: options.runtimeStatus,
    runtimeSource: options.runtimeSource,
    steps:
      task.steps?.map((s) => ({
        id: s.id,
        title: s.title,
        done: completed.has(s.id),
      })) ?? [],
    dueAt: task.dueAt ? format(task.dueAt, "PP HH:mm") : undefined,
    dueAtRaw: task.dueAt ?? undefined,
    estimatedDuration: task.estimatedDuration,
    isForced: options.isForced ?? false,
    forcedDueAt: resolveForcedDueAt(source, task, options.runtimeSource),
    isRepeatTask: options.isRepeatTask ?? task.repeat != null,
    plannedForDate: options.plannedForDate,
    plannedForLabel: options.plannedForLabel,
    repeatRuleSummary: task.repeat
      ? summarizeRepeatRule(task.repeat.rule, source.t)
      : undefined,
    isDebtItem,
    canRunAgain: canAddRunToday(task, source.taskRuntime),
    carriedOverLabel,
    // Day-scoped: set only while the user has it removed from today's plan.
    // Re-adding it by hand clears the dismissal, so this flips back off.
    isDismissedToday: source.dismissedTaskIds.has(task.id),
  }
}

function sortTaskItems(items: TasksTaskItemVM[]): TasksTaskItemVM[] {
  return [...items].sort((left, right) => {
    const leftTime = left.plannedForDate
      ? parseDateKey(left.plannedForDate).getTime()
      : left.dueAtRaw
        ? startOfDay(left.dueAtRaw).getTime()
        : Number.POSITIVE_INFINITY
    const rightTime = right.plannedForDate
      ? parseDateKey(right.plannedForDate).getTime()
      : right.dueAtRaw
        ? startOfDay(right.dueAtRaw).getTime()
        : Number.POSITIVE_INFINITY

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

export function buildTasksPageVM(source: TasksPageSource): TasksPageVM {
  const now = new Date()
  const today = startOfDay(now)
  const todayKey = toLocalDateKey(now)
  const tasks = Object.values(source.tasks)

  const runtimeEntries = Object.values(source.taskRuntime).filter(
    (runtime) => source.tasks[runtime.taskId] != null
  )

  const todayItems = sortTaskItems(
    runtimeEntries.map((runtime) => {
      const task = source.tasks[runtime.taskId]!
      const isRepeat = runtime.source === "repeatPolicy"
      const plannedForDate = isRepeat ? runtime.plannedForDate : undefined
      return toTaskPreview(source, task, {
        runtimeId: runtime.id,
        runtimeStatus: runtime.arrangementStatus,
        runtimeSource: runtime.source,
        plannedForDate,
        plannedForLabel: plannedForDate
          ? formatPlanLabel(source.t.tasks.planOn, plannedForDate)
          : undefined,
        isForced: isForcedRuntime(runtime),
        todayKey,
        stepsCompleted: runtime.stepsCompleted,
        runtime,
      })
    })
  )
  const usedMinutes = todayItems.reduce(
    (sum, item) => sum + (item.estimatedDuration ?? 0),
    0
  )

  const repeatTaskIds = new Set(
    tasks.filter((task) => task.repeat != null).map((task) => task.id)
  )

  // Finished tasks are history, not plannable — mirrors the planner's
  // isTaskFinished guard on every scheduling path.
  const isFinished = (task: TaskGroupEntity) =>
    task.completedCount >= task.total

  const plannableTasks = tasks.filter(
    (task) =>
      !isFinished(task) && !hasTaskRuntimeForTask(source.taskRuntime, task.id)
  )

  const getDaysAhead = (date: Date) =>
    differenceInCalendarDays(startOfDay(date), today)

  const tomorrowTasks = plannableTasks.filter(
    (task) =>
      task.dueAt != null &&
      getDaysAhead(task.dueAt) === 1 &&
      !repeatTaskIds.has(task.id)
  )

  const in7DaysTasks = plannableTasks.filter((task) => {
    if (task.dueAt == null || repeatTaskIds.has(task.id)) {
      return false
    }

    const daysAhead = getDaysAhead(task.dueAt)
    return daysAhead >= 2 && daysAhead <= 7
  })

  // Scheduled by the trigger machinery (own trigger, or the goal's — a goal
  // trigger periodically resets all of its tasks) and already surfaced under
  // Plans > By Trigger.
  const isTriggerScheduled = (task: TaskGroupEntity) =>
    task.trigger != null ||
    (task.goalId != null && source.goals[task.goalId]?.trigger != null)

  const unselectedTasks = plannableTasks.filter((task) => {
    // Repeat tasks are governed by their ledger (skip/debt), never "unscheduled".
    if (repeatTaskIds.has(task.id)) return false
    // Removed from today by hand: a trigger is just "a normal task + a condition",
    // so once dismissed it belongs here (badged) exactly like a plain task —
    // this is the only actionable place to pull it back. It also stays listed
    // under Plans > By Trigger, which shows when it will fire again.
    if (source.dismissedTaskIds.has(task.id)) return true
    if (isTriggerScheduled(task)) return false
    // Due tomorrow..7 days → already shown in the Plans tab; a farther (or no)
    // due date stays here so the task doesn't vanish from every tab.
    if (task.dueAt != null) {
      const daysAhead = getDaysAhead(task.dueAt)
      if (daysAhead >= 1 && daysAhead <= 7) return false
    }
    return true
  })

  const repeatPlanItems: TasksTaskItemVM[] = tasks
    .filter((task) => task.repeat != null && !isFinished(task))
    .flatMap((task) => {
      const ledger = source.repeatLedger[task.id]
      if (!ledger) {
        return []
      }

      return getFuturePoints(ledger, todayKey, 7)
        .filter(
          (dateKey) =>
            source.taskRuntime[
              createTaskRuntimeId(task.id, "repeatPolicy", dateKey)
            ] == null
        )
        .map((dateKey) =>
          toTaskPreview(source, task, {
            runtimeId: createTaskRuntimeId(task.id, "repeatPolicy", dateKey),
            runtimeStatus: null,
            runtimeSource: "repeatPolicy",
            plannedForDate: dateKey,
            plannedForLabel: formatPlanLabel(source.t.tasks.planOn, dateKey),
            isForced: false,
            isRepeatTask: true,
            todayKey,
          })
        )
    })

  const tomorrowRepeatPlanItems = repeatPlanItems.filter((item) => {
    if (!item.plannedForDate) {
      return false
    }

    return getDaysAhead(parseDateKey(item.plannedForDate)) === 1
  })

  const in7DaysRepeatPlanItems = repeatPlanItems.filter((item) => {
    if (!item.plannedForDate) {
      return false
    }

    const daysAhead = getDaysAhead(parseDateKey(item.plannedForDate))
    return daysAhead >= 2 && daysAhead <= 7
  })

  return {
    today: {
      // Same multi-item display rules as Home (shared helper): open items get an
      // ordinal, finished ones collapse to a single counted row.
      todo: ordinaliseOpenItems(
        todayItems.filter((item) => item.runtimeStatus === "todo"),
        source.t
      ),
      inProgress: ordinaliseOpenItems(
        todayItems.filter((item) => item.runtimeStatus === "inProgress"),
        source.t
      ),
      done: collapseDoneItems(
        todayItems.filter((item) => item.runtimeStatus === "done"),
        source.taskRuntime,
        source.t
      ),
    },
    timeQuota: {
      usedMinutes,
      dailyCapacityMinutes: source.policy.dailyCapacityMinutes,
    },
    plans: {
      tomorrow: sortTaskItems([
        ...tomorrowTasks.map((task) =>
          toTaskPreview(source, task, {
            runtimeId: createTaskRuntimeId(task.id),
            runtimeStatus: null,
            todayKey,
          })
        ),
        ...tomorrowRepeatPlanItems,
      ]),
      in7Days: sortTaskItems([
        ...in7DaysTasks.map((task) =>
          toTaskPreview(source, task, {
            runtimeId: createTaskRuntimeId(task.id),
            runtimeStatus: null,
            todayKey,
          })
        ),
        ...in7DaysRepeatPlanItems,
      ]),
    },
    unselected: sortTaskItems(
      unselectedTasks.map((task) =>
        toTaskPreview(source, task, {
          runtimeId: createTaskRuntimeId(task.id),
          runtimeStatus: null,
          todayKey,
        })
      )
    ),
  }
}
