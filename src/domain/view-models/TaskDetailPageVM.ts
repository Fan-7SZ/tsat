import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  ActivityID,
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type { ActivityKind } from "@/domain/entities/ActivityEntity"

export interface TaskDetailHistoryItemVM {
  id: ActivityID
  kind: ActivityKind
  taskId: TaskID
  taskTitle: string
  recordedAtLabel: string
}

export interface TaskDetailPageVM {
  task: TaskGroupEntity
  goalTitle?: string
  goalId?: GoalID
  /**
   * The task's steps joined with the active completion runtime's progress, for
   * the completion checklist. Read-only projection; `task.steps` stays the raw
   * entity used for editing.
   */
  checklistSteps: { id: string; title: string; done: boolean }[]
  /** Runtime that owns the checklist progress (write-back target); absent when
   * completion only bumps completedCount with no runtime. */
  completionRuntimeId?: TaskRuntimeID
  /**
   * The user removed this task from TODAY's plan. Day-scoped — clears at the day
   * boundary or when the task is re-added by hand.
   */
  isDismissedToday?: boolean
}
