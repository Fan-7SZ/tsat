import { differenceInCalendarDays } from "date-fns"
import { toLocalDateKey } from "@/utils/date"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { GoalBlockingFocusStatus } from "@/domain/derived/GoalFocus"
import type { PlannerPolicy } from "@/services/planner/types"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import { getTaskRuntimeEntries } from "@/utils/task-runtime"
import { isTaskFinished } from "./planning-helpers"

// ── Task forced-today check ─────────────────────────────────

export type TaskForcedResult =
  | { isForced: false }
  | { isForced: true; dueAt: Date }

/** Determine whether a task must be forced into today's runtime.
 * @param task The task to check.
 * @param policy The planner policy to use for the check.
 * @param now The current date.
 * @returns A discriminated union indicating whether the task is forced and the due date if applicable.
 */
export function isTaskForcedToday(
  task: TaskGroupEntity,
  policy: PlannerPolicy,
  now: Date
): TaskForcedResult {
  // Only plain, un-scheduled tasks are eligible for due forcing. Trigger tasks
  // enter via triggerPolicy and repeat tasks via their ledger occurrences; due
  // policy must never pull either in (completing a due-forced repeat run bumps
  // completedCount with no ledger point).
  if (task.trigger != null || task.repeat != null) return { isForced: false }
  // A finished task has nothing left to schedule; overdue stays overdue
  // forever (daysUntilDue goes negative), so without this a completed
  // past-due task would be re-forced into every future day.
  if (isTaskFinished(task)) return { isForced: false }
  if (task.dueAt == null) return { isForced: false }
  const daysUntilDue = differenceInCalendarDays(task.dueAt, now)
  if (daysUntilDue <= policy.taskForcedTodoDays) {
    return { isForced: true, dueAt: task.dueAt }
  }
  return { isForced: false }
}

/** Whether a goal's own dueAt falls inside the forced-focus window today. */
export function isGoalDueForcedToday(
  goal: GoalEntity,
  policy: PlannerPolicy,
  now: Date
): boolean {
  if (goal.dueAt == null) return false
  return differenceInCalendarDays(goal.dueAt, now) <= policy.goalForcedFocusDays
}

// ── Goal forced-focused check ───────────────────────────────

export interface GoalForcedResult {
  statuses: GoalBlockingFocusStatus[]
}

/**
 * Determine whether a goal must be forced into focused state.
 *
 * For each linked task, at most one task-level blocking reason is produced,
 * chosen by priority: manualTodayTask > repeatPolicyPoint > taskDuePolicy.
 * The goal-level goalDuePolicy is independent and always included when applicable.
 * @param goal The goal to check.
 * @param goalTasks The tasks linked to the goal.
 * @param taskRuntime The runtime information for tasks.
 * @param policy The planner policy to use for the check.
 * @param now The current date.
 * @returns The result indicating the blocking statuses for the goal.
 */
export function isGoalForcedFocused(
  goal: GoalEntity,
  goalTasks: TaskGroupEntity[],
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  policy: PlannerPolicy,
  now: Date
): GoalForcedResult {
  // A goal with no tasks is never force-focused: there is nothing to schedule,
  // so ignore its own due date and any trigger-derived due (a trigger reset
  // writes a dueAt onto the goal, which would otherwise force goalDuePolicy).
  if (goalTasks.length === 0) {
    return { statuses: [] }
  }

  const statuses: GoalBlockingFocusStatus[] = []

  // Per-task: choose the single highest-priority task-level blocking reason.
  // Priority: manualTodayTask (0) > repeatPolicyPoint (1) > taskTriggerPolicy (2) > taskDuePolicy (3)
  //
  // In practice very few of these can co-occur on the same task, so this chain
  // is mostly defensive. Two structural facts constrain it:
  //  1. A single-run task's non-repeat runtime is the bare taskId for every
  //     source (default / duePolicy / triggerPolicy), so its default, duePolicy
  //     and triggerPolicy runtimes can never coexist — they overwrite each other
  //     on the same key. (Counters key their runs by date, but a counter is
  //     total>1, so it has no trigger and no repeat: the priority mix below can
  //     never arise for it either.)
  //  2. Config is mutually exclusive: trigger ⊥ repeat, trigger ⊥ dueAt, and
  //     repeat clears dueAt. So taskDuePolicy (derived from task.dueAt) cannot
  //     pair with repeat or trigger reasons.
  // Net effect: the only genuinely reachable tie is manualTodayTask vs
  // taskDuePolicy (a manually-added plain task that is also near its due date).
  // taskTriggerPolicy can never tie with anything — a trigger task has no due,
  // no repeat, and a manual runtime would share its id — so its slot here is
  // purely defensive and never actually breaks a tie.
  const taskPrimaryReason = new Map<TaskID, GoalBlockingFocusStatus>()

  for (const task of goalTasks) {
    const runtimes = getTaskRuntimeEntries(taskRuntime, task.id)

    // Check manual
    const isManualToday = runtimes.some((rt) => rt.source === "manual")
    if (isManualToday) {
      taskPrimaryReason.set(task.id, {
        kind: "manualTodayTask",
        isBlocking: true,
        taskId: task.id,
        taskTitle: task.title,
      })
      continue // highest priority, skip remaining checks
    }

    // Check repeat policy
    const repeatRuntime = runtimes.find((rt) => rt.source === "repeatPolicy")
    if (repeatRuntime != null) {
      taskPrimaryReason.set(task.id, {
        kind: "repeatPolicyPoint",
        isBlocking: true,
        taskId: task.id,
        taskTitle: task.title,
        plannedForDate: repeatRuntime.plannedForDate ?? "",
      })
      continue // second-highest priority
    }

    // Check trigger policy
    const hasTriggerRuntime = runtimes.some(
      (rt) => rt.source === "triggerPolicy"
    )
    if (hasTriggerRuntime) {
      taskPrimaryReason.set(task.id, {
        kind: "taskTriggerPolicy",
        isBlocking: true,
        taskId: task.id,
        taskTitle: task.title,
        firedDate: toLocalDateKey(now),
      })
      continue
    }

    // Check due policy
    const result = isTaskForcedToday(task, policy, now)
    if (result.isForced) {
      taskPrimaryReason.set(task.id, {
        kind: "taskDuePolicy",
        isBlocking: true,
        taskId: task.id,
        taskTitle: task.title,
        dueAt: result.dueAt,
      })
    }
  }

  for (const status of taskPrimaryReason.values()) {
    statuses.push(status)
  }

  // NOTE: a fired goal trigger is deliberately NOT a forced reason here. Firing
  // happens once, at the day boundary, and records its pull-up as a day-scoped
  // manualFocus row (see runTriggerResetIfNeeded). Deriving it instead from
  // `lastTriggeredDateKey === todayKey` made it a lock that held all day, so
  // un-focusing the goal was undone by the very next replan.

  // Goal-level: own dueAt within window (independent of task-level reasons)
  if (goal.dueAt != null && isGoalDueForcedToday(goal, policy, now)) {
    statuses.push({
      kind: "goalDuePolicy",
      isBlocking: true,
      dueAt: goal.dueAt,
    })
  }

  return { statuses }
}
