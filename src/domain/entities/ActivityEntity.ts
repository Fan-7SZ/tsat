import type {
  ActivityID,
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

export type ActivityKind = "task-done" | "task-in-progress" | "repeat-skip"

export interface ActivityEntity {
  id: ActivityID
  kind: ActivityKind
  taskId: TaskID
  goalId?: GoalID
  runtimeId: TaskRuntimeID
  plannedForDate?: LocalDateKey
  recordedDateKey: LocalDateKey
  recordedAt: Date
  taskTitleSnapshot: string
}

/**
 * Stable id for a runtime-driven activity. A runtime is one *run* of a task, and
 * separate runs carry separate ids, so a counter task done twice today records
 * two task-done entries rather than the second overwriting the first — which is
 * what keeps completedCount in step with the activities it is derived from.
 */
export function createStableActivityId(
  kind: ActivityKind,
  runtimeId: TaskRuntimeID
): ActivityID {
  return `act::${kind}::${runtimeId}` as ActivityID
}

export function createStableRepeatResolutionActivityId(
  kind: Extract<ActivityKind, "task-done" | "repeat-skip">,
  taskId: TaskID,
  plannedForDate: LocalDateKey
): ActivityID {
  return `act::${kind}::repeat-resolution::${taskId}::${plannedForDate}` as ActivityID
}
