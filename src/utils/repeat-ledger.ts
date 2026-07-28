import { addDays, startOfDay } from "date-fns"
import { toLocalDateKey } from "@/utils/date"
import type {
  RepeatLedgerEntity,
  RepeatPointStatus,
} from "@/domain/entities/RepeatLedgerEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { computePlannedExecutionDates } from "@/utils/repeat-count"
import { resolveRepeatWindow } from "@/utils/repeat-window"
import { createTaskRuntimeId } from "@/utils/task-runtime"

/**
 * Reconciles a repeat rule's planned dates with an existing ledger.
 * History is preserved (`completed`/`skipped` points are always kept), while
 * `planned` points are pruned to exactly the rule's current dates: stale
 * planned points the rule does not produce any more are dropped, and newly-covered
 * dates are added as "planned" (without overwriting an existing completed point).
 * Returns null when the task has no repeat mode or no valid window.
 */
export function mergeLedgerWithRule(options: {
  task: TaskGroupEntity
  existing?: RepeatLedgerEntity
}): RepeatLedgerEntity | null {
  const { task, existing } = options
  if (task.repeat == null) {
    return null
  }

  const window = resolveRepeatWindow(
    task.createdAt,
    task.repeat.startsAt,
    task.repeat.endsAt
  )
  if (!window) {
    return null
  }

  const plannedDates = computePlannedExecutionDates(
    window.start,
    window.end,
    task.repeat.rule
  )
  const validKeys = new Set(plannedDates.map((date) => toLocalDateKey(date)))

  const points: Record<LocalDateKey, RepeatPointStatus> = {}
  // Keep history (completed/skipped) and any still-valid planned point; drop
  // planned points the new rule does not produce.
  for (const [key, status] of Object.entries(existing?.points ?? {}) as Array<
    [LocalDateKey, RepeatPointStatus]
  >) {
    if (status !== "planned" || validKeys.has(key)) {
      points[key] = status
    }
  }
  // Add newly-covered dates, without overwriting an existing completed/skipped.
  for (const key of validKeys) {
    if (points[key] == null) {
      points[key] = "planned"
    }
  }

  return { taskId: task.id, points }
}

/**
 * Returns all dateKeys with status "planned" whose date is <= today.
 * These are today's actionable points (including past-due "debt" points).
 */
export function getActiveTodayPoints(
  ledger: RepeatLedgerEntity,
  todayKey: LocalDateKey
): LocalDateKey[] {
  return Object.entries(ledger.points)
    .filter(([key, status]) => status === "planned" && key <= todayKey)
    .map(([key]) => key as LocalDateKey)
    .sort()
}

/**
 * Returns "planned" dateKeys strictly in the future, capped to windowDays.
 */
export function getFuturePoints(
  ledger: RepeatLedgerEntity,
  todayKey: LocalDateKey,
  windowDays = 7
): LocalDateKey[] {
  const horizonKey = toLocalDateKey(addDays(startOfDay(new Date()), windowDays))
  return Object.entries(ledger.points)
    .filter(
      ([key, status]) =>
        status === "planned" && key > todayKey && key <= horizonKey
    )
    .map(([key]) => key as LocalDateKey)
    .sort()
}

export function createRepeatRuntimeEntity(options: {
  taskId: TaskID
  dateKey: LocalDateKey
  arrangementStatus?: TaskRuntimeEntity["arrangementStatus"]
}): TaskRuntimeEntity {
  const { taskId, dateKey, arrangementStatus = "todo" } = options
  return {
    id: createTaskRuntimeId(taskId, "repeatPolicy", dateKey),
    taskId,
    arrangementStatus,
    source: "repeatPolicy",
    plannedForDate: dateKey,
  }
}
