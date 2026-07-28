import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskDetailPageVM } from "@/domain/view-models/TaskDetailPageVM"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import { selectCompletionRuntime } from "@/utils/task-runtime"

type BuildTaskDetailPageVMInput = {
  task: TaskGroupEntity
  goal: GoalEntity | null
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
  /** Tasks the user removed from today's plan (day-scoped). */
  dismissedTaskIds: ReadonlySet<TaskID>
}

export function buildTaskDetailPageVM({
  task,
  goal,
  taskRuntime,
  dismissedTaskIds,
}: BuildTaskDetailPageVMInput): TaskDetailPageVM {
  // Join the task's steps with the active completion runtime's progress so the
  // checklist reflects (and writes back to) runtime.stepsCompleted.
  const completionRuntime = selectCompletionRuntime(taskRuntime, task)
  const completed = new Set(completionRuntime?.stepsCompleted ?? [])

  return {
    task,
    goalId: task.goalId,
    goalTitle: goal?.title,
    checklistSteps:
      task.steps?.map((s) => ({
        id: s.id,
        title: s.title,
        done: completed.has(s.id),
      })) ?? [],
    completionRuntimeId: completionRuntime?.id,
    // Day-scoped "removed from today"; clears at the day boundary.
    isDismissedToday: dismissedTaskIds.has(task.id),
  }
}
