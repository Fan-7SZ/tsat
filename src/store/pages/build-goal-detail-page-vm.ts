import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalDetailPageVM } from "@/domain/view-models/GoalDetailPageVM"

type BuildGoalDetailPageVMInput = {
  goal: GoalEntity
  tasks: TaskGroupEntity[]
  dependencyTree: DependencyEntity | null
}

export function buildGoalDetailPageVM({
  goal,
  tasks,
  dependencyTree,
}: BuildGoalDetailPageVMInput): GoalDetailPageVM {
  const completedCount = tasks.reduce(
    (sum, task) => sum + task.completedCount,
    0
  )
  const totalCount = tasks.reduce((sum, task) => sum + task.total, 0)
  const totalTimeSpentMinutes = tasks.reduce(
    (sum, task) => sum + (task.estimatedDuration ?? 0) * task.completedCount,
    0
  )

  return {
    goal,
    progress: {
      completedCount,
      totalCount,
      progressPercent:
        totalCount === 0
          ? 0
          : Math.min(100, Math.round((completedCount / totalCount) * 100)),
      totalTimeSpentLabel: `${totalTimeSpentMinutes}m`,
    },
    createdByGoalTasks: tasks.map((task) => ({
      taskId: task.id,
      title: task.title,
      currentComplete: task.completedCount,
      totalCount: task.total,
    })),
    dependencyTree,
    requiresTriggerNormalization: tasks.some(
      (task) => task.total !== 1 || task.repeat != null || task.trigger != null
    ),
  }
}
