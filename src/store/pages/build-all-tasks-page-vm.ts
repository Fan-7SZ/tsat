import { format } from "date-fns"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type {
  AllTasksPageVM,
  AllTasksRowVM,
} from "@/domain/view-models/AllTasksPageVM"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import {
  aggregateRuntimeStatus,
  hasTaskRuntimeForTask,
} from "@/utils/task-runtime"

type BuildAllTasksPageVMInput = {
  goals: Record<GoalID, GoalEntity>
  tasks: Record<TaskID, TaskGroupEntity>
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
}

export function buildAllTasksPageVM({
  goals,
  tasks,
  taskRuntime,
}: BuildAllTasksPageVMInput): AllTasksPageVM {
  const rows: AllTasksRowVM[] = Object.values(tasks).map((task) => {
    const hasRuntime = hasTaskRuntimeForTask(taskRuntime, task.id)
    // A task may hold several runs today; this row shows one status for all of
    // them (see aggregateRuntimeStatus).
    const status = aggregateRuntimeStatus(taskRuntime, task.id)

    return {
      taskId: task.id,
      title: task.title,
      goalId: task.goalId ?? undefined,
      goalTitle: task.goalId ? goals[task.goalId]?.title : undefined,
      inRuntime: hasRuntime,
      runtimeStatus: status ?? null,
      dueAt: task.dueAt ?? null,
      dueAtLabel: task.dueAt ? format(task.dueAt, "PP") : undefined,
      estimatedDuration: task.estimatedDuration,
      stepsCount: task.steps?.length ?? 0,
      completedCount: task.completedCount,
      totalCount: task.total,
    }
  })

  rows.sort((left, right) => {
    if (left.dueAt && right.dueAt)
      return left.dueAt.getTime() - right.dueAt.getTime()
    if (left.dueAt) return -1
    if (right.dueAt) return 1
    return 0
  })

  const goalMap = new Map<string, string>()
  for (const row of rows) {
    if (row.goalId && row.goalTitle) {
      goalMap.set(row.goalId, row.goalTitle)
    }
  }

  return {
    rows,
    goalOptions: Array.from(goalMap, ([value, label]) => ({
      value: value as GoalID,
      label,
    })),
  }
}
