import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"

/**
 * A goal is done once every task under it is done — and only if it has tasks at
 * all, so an empty goal never reads as finished. Callers that already hold a
 * goal's task list (e.g. the sidebar tree) use this directly; `isGoalDone`
 * filters a task record down to the goal first.
 */
export function areGoalTasksAllDone(tasks: TaskGroupEntity[]): boolean {
  return (
    tasks.length > 0 &&
    tasks.every((task) => task.completedCount >= task.total)
  )
}

export function isGoalDone(
  goalId: GoalID,
  tasks: Record<TaskID, TaskGroupEntity>
): boolean {
  return areGoalTasksAllDone(
    Object.values(tasks).filter((task) => task.goalId === goalId)
  )
}
