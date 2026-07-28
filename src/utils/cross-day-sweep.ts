import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"

/**
 * Cross-day carry-over selection used at the day boundary: keep only the
 * runtimes of tasks that opted into cross-day AND are currently in progress,
 * plus the ids of the goals those tasks belong to (their manual focus survives
 * the boundary). Everything else is dropped so the scheduler can rebuild
 * today's plan from scratch.
 *
 * Repeat-rule tasks never carry over — their pull-up dates are fixed, so a
 * cross-day window would only add uncertainty; the `task.repeat == null` guard
 * is defensive since such tasks cannot set `allowCrossDay` in the first place.
 */
export function selectCrossDayCarryOver(input: {
  tasks: TaskGroupEntity[]
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
}): {
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
  keptGoalIds: Set<GoalID>
} {
  const taskById = new Map<TaskID, TaskGroupEntity>(
    input.tasks.map((task) => [task.id, task])
  )

  const keptTaskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity> = {}
  const keptGoalIds = new Set<GoalID>()

  for (const runtime of Object.values(input.taskRuntime)) {
    const task = taskById.get(runtime.taskId)
    if (!task) continue
    if (task.repeat != null) continue
    if (!task.allowCrossDay) continue
    if (runtime.arrangementStatus !== "inProgress") continue

    keptTaskRuntime[runtime.id] = runtime
    if (task.goalId) keptGoalIds.add(task.goalId)
  }

  return { taskRuntime: keptTaskRuntime, keptGoalIds }
}
