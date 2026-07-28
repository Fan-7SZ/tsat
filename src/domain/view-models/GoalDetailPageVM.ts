import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { ActivityID, TaskID } from "@/domain/value-objects/types"
import type { ActivityKind } from "@/domain/entities/ActivityEntity"

export interface GoalDetailTaskItemVM {
  taskId: TaskID
  title: string
  currentComplete: number
  totalCount: number
}

export interface GoalProgressVM {
  completedCount: number
  totalCount: number
  progressPercent: number
  totalTimeSpentLabel: string
}

export interface GoalDetailActivityItemVM {
  id: ActivityID
  kind: ActivityKind
  taskId: TaskID
  taskTitle: string
  recordedAtLabel: string
}

export interface GoalDetailPageVM {
  goal: GoalEntity
  progress: GoalProgressVM
  createdByGoalTasks: GoalDetailTaskItemVM[]
  dependencyTree: DependencyEntity | null
  /**
   * True when at least one task is not single-run (total !== 1, or has a repeat
   * or trigger rule). Enabling a goal trigger requires normalizing these tasks,
   * so the UI must confirm with the user first.
   */
  requiresTriggerNormalization: boolean
}
