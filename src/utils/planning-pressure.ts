import { addDays, format, startOfDay } from "date-fns"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { toLocalDateKey } from "@/utils/date"
import { projectUpcomingTriggerFires } from "@/services/planner/projection"
import { isGoalDone } from "@/utils/goal-done"

/** Why a task/goal was pulled up on a given day. */
export type PressureReason = "repeat" | "taskTrigger" | "goalTrigger"

/** A single item contributing to a day's planning pressure. */
export interface PressureContribution {
  /** What scheduling mechanism pulled this up. */
  reason: PressureReason
  /** Owning goal (goalTrigger → that goal; repeat/taskTrigger → task.goalId). */
  goalId?: GoalID
  /** Owning goal title; undefined → UI groups under "no goal". */
  goalTitle?: string
  /** Contributing task; undefined for goalTrigger (no specific task). */
  taskId?: TaskID
  /** task.title; goalTrigger uses the goal's title. */
  title: string
  /** Estimated minutes for this item (when known). */
  minutes?: number
}

/** A task or goal whose own dueAt lands on a given day. */
export interface DueContribution {
  /** Whether this due belongs to a task or a goal. */
  kind: "task" | "goal"
  id: string
  title: string
  /** For a task: its owning goal's title (if any); undefined for a goal. */
  goalTitle?: string
  /** Localized time-of-day label, e.g. "14:30" (omitted for all-day). */
  timeLabel?: string
}

/** Aggregated planning load pulled up on a single day. */
export interface DayPressure {
  /** Tasks pulled up that day (repeat points + trigger fires). Drives heat. */
  count: number
  /** Total estimated minutes for the day (optional, shown as a hint). */
  minutes?: number
  /** Per-item breakdown of what was pulled up (one entry per `count`). */
  items: PressureContribution[]
  /**
   * Tasks/goals whose own dueAt falls on this day. Independent of `count`/heat;
   * drives the destructive due emphasis (cell border + hover-card section).
   */
  due?: DueContribution[]
}

export interface ComputePressureOptions {
  tasks: Record<TaskID, TaskGroupEntity>
  goals: Record<GoalID, GoalEntity>
  repeatLedger: Record<TaskID, RepeatLedgerEntity>
  /** Forecast anchor (today). */
  now: Date
  /** Forecast length in days. */
  days: number
}

/**
 * Per-day planning pressure for the `[now, now + days)` window: how many tasks
 * the repeat rules and trigger rules (task- and goal-level) pull up each day.
 *
 * - repeat: each repeat ledger's "planned" points within the window (+1).
 * - task trigger: each `task.trigger` fire date within its validity window (+1).
 * - goal trigger: a goal with a trigger forces its tasks to single-run, so the
 *   goal trigger pulls up *each* of the goal's (unfinished) tasks on every fire
 *   date (one `goalTrigger` contribution per task). Mirrors the domain rule in
 *   `buildTriggerPlanItems`.
 *
 * Each contributing item is recorded in `items` (one entry per `count`).
 * `minutes` accumulates the contributing tasks' estimated duration (a hint).
 */
export function computePressureByDay({
  tasks,
  goals,
  repeatLedger,
  now,
  days,
}: ComputePressureOptions): Record<LocalDateKey, DayPressure> {
  const result: Record<string, DayPressure> = {}
  const todayKey = toLocalDateKey(now)
  const horizonKey = toLocalDateKey(addDays(startOfDay(now), days - 1))

  const bump = (dateKey: LocalDateKey, contribution: PressureContribution) => {
    const entry = result[dateKey] ?? { count: 0, minutes: 0, items: [] }
    entry.count += 1
    if (contribution.minutes) {
      entry.minutes = (entry.minutes ?? 0) + contribution.minutes
    }
    entry.items.push(contribution)
    result[dateKey] = entry
  }

  // ── repeat: planned ledger points within the window ──
  for (const ledger of Object.values(repeatLedger)) {
    const task = tasks[ledger.taskId]
    if (task == null) continue
    const goalTitle = task.goalId ? goals[task.goalId]?.title : undefined
    for (const [key, status] of Object.entries(ledger.points)) {
      const dateKey = key as LocalDateKey
      if (status !== "planned") continue
      if (dateKey < todayKey || dateKey > horizonKey) continue
      bump(dateKey, {
        reason: "repeat",
        taskId: task.id,
        title: task.title,
        goalId: task.goalId ?? undefined,
        goalTitle,
        minutes: task.estimatedDuration,
      })
    }
  }

  // ── triggers, per task ──
  // One contribution per predicted fire date; the goal-vs-task trigger
  // resolution and fire enumeration live in the shared projection.
  for (const task of Object.values(tasks)) {
    const goal = task.goalId ? goals[task.goalId] : undefined
    const projection = projectUpcomingTriggerFires({ task, goal, now, days })
    if (!projection) continue
    const reason: PressureReason = projection.byGoalTrigger
      ? "goalTrigger"
      : "taskTrigger"

    for (const dateKey of projection.fires) {
      bump(dateKey, {
        reason,
        taskId: task.id,
        title: task.title,
        goalId: task.goalId ?? undefined,
        goalTitle: goal?.title,
        minutes: task.estimatedDuration,
      })
    }
  }

  // ── due: tasks/goals whose own dueAt lands in the window ──
  // Independent of `count`/heat: drives the destructive due emphasis only.
  const addDue = (dateKey: LocalDateKey, contribution: DueContribution) => {
    const entry = result[dateKey] ?? {
      count: 0,
      minutes: 0,
      items: [],
      due: [],
    }
    entry.due = entry.due ?? []
    entry.due.push(contribution)
    result[dateKey] = entry
  }

  for (const task of Object.values(tasks)) {
    if (task.dueAt == null) continue
    if (task.completedCount >= task.total) continue
    const dateKey = toLocalDateKey(task.dueAt)
    if (dateKey < todayKey || dateKey > horizonKey) continue
    addDue(dateKey, {
      kind: "task",
      id: task.id,
      title: task.title,
      goalTitle: task.goalId ? goals[task.goalId]?.title : undefined,
      timeLabel: format(task.dueAt, "HH:mm"),
    })
  }

  for (const goal of Object.values(goals)) {
    if (goal.dueAt == null) continue
    if (isGoalDone(goal.id, tasks)) continue
    const dateKey = toLocalDateKey(goal.dueAt)
    if (dateKey < todayKey || dateKey > horizonKey) continue
    addDue(dateKey, {
      kind: "goal",
      id: goal.id,
      title: goal.title,
      timeLabel: format(goal.dueAt, "HH:mm"),
    })
  }

  return result as Record<LocalDateKey, DayPressure>
}
