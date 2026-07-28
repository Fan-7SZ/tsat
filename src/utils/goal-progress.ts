import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"

/** Summed completion counters for a goal's tasks. */
export function computeGoalCompletionCounts(
  goalId: GoalID,
  tasks: Record<TaskID, TaskGroupEntity>
): { completedCount: number; totalCount: number } {
  let completedCount = 0
  let totalCount = 0
  for (const task of Object.values(tasks)) {
    if (task.goalId !== goalId) continue
    completedCount += task.completedCount
    totalCount += task.total
  }
  return { completedCount, totalCount }
}

/**
 * Goal completion ratio = Σ task.completedCount / Σ task.total, in [0, 1].
 * A goal with no planned total returns 1 (nothing left to do).
 */
export function computeGoalCompletionRatio(
  goalId: GoalID,
  tasks: Record<TaskID, TaskGroupEntity>
): number {
  const { completedCount, totalCount } = computeGoalCompletionCounts(
    goalId,
    tasks
  )
  if (totalCount <= 0) return 1
  return completedCount / totalCount
}
