import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { TaskRuntimeStatus } from "@/domain/entities/TaskRuntimeEntity"

export interface AllTasksRowVM {
  taskId: TaskID
  title: string
  goalId?: GoalID
  goalTitle?: string
  inRuntime: boolean
  runtimeStatus: TaskRuntimeStatus | null
  dueAt: Date | null
  dueAtLabel?: string
  estimatedDuration?: number
  stepsCount: number
  completedCount: number
  totalCount: number
}

export interface AllTasksPageVM {
  rows: AllTasksRowVM[]
  goalOptions: { value: GoalID; label: string }[]
}
