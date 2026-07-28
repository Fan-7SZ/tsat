import { toast } from "sonner"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import * as repo from "@/persistence/repository"
import { useAppStore } from "@/store/app-store"
import { validateTreeRepeatIntegrity } from "@/utils/repeat-validation"

function scheduleReplan(): Promise<void> {
  return Promise.resolve(useAppStore.getState().replan("partial"))
}

function shouldTriggerGoalSchedulerReplan(
  patch: Partial<Omit<GoalEntity, "id">>
): boolean {
  return "dueAt" in patch
}

function hasRepeatTasks(tasks: TaskGroupEntity[]): boolean {
  return tasks.some((task) => task.repeat != null)
}

function buildTaskRecord(
  tasks: TaskGroupEntity[]
): Record<TaskID, TaskGroupEntity> {
  return Object.fromEntries(tasks.map((task) => [task.id, task])) as Record<
    TaskID,
    TaskGroupEntity
  >
}

export async function createGoal(
  goal: GoalEntity,
  failureMessage?: string
): Promise<boolean> {
  if (goal.trigger != null && goal.dueAt != null) {
    toast.error("Triggered goals cannot use a fixed due date.")
    return false
  }

  try {
    await repo.putGoal(goal)

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[goal.commands] Failed to create goal", error)
    toast.error(failureMessage ?? "Failed to create goal.")
    return false
  }
}

export async function updateGoal(
  id: GoalID,
  patch: Partial<Omit<GoalEntity, "id">>,
  failureMessage?: string
): Promise<boolean> {
  const current = await repo.queryGoalById(id)
  if (!current) {
    return false
  }

  const nextGoal = { ...current, ...patch, id: current.id }

  if (nextGoal.trigger != null) {
    if (nextGoal.dueAt != null) {
      toast.error("Triggered goals cannot use a fixed due date.")
      return false
    }

    const tasks = await repo.queryTasksByGoal(id)
    if (hasRepeatTasks(tasks)) {
      toast.error("Triggered goals cannot contain repeating tasks.")
      return false
    }
  }

  if (shouldTriggerGoalSchedulerReplan(patch)) {
    const [tasks, dependency] = await Promise.all([
      repo.queryTasksByGoal(id),
      repo.queryDependencyByGoal(id),
    ])

    if (dependency) {
      const result = validateTreeRepeatIntegrity(
        dependency,
        buildTaskRecord(tasks),
        nextGoal
      )
      if (!result.valid) {
        toast.error(result.errorMessage)
        return false
      }
    }
  }

  try {
    const updatedCount = await repo.patchGoal(id, patch)
    if (updatedCount === 0) {
      return false
    }

    if (shouldTriggerGoalSchedulerReplan(patch)) {
      await scheduleReplan()
    }

    return true
  } catch (error) {
    console.error("[goal.commands] Failed to update goal", error)
    toast.error(failureMessage ?? "Failed to update goal.")
    return false
  }
}

export async function deleteGoal(
  id: GoalID,
  failureMessage?: string
): Promise<boolean> {
  const goal = await repo.queryGoalById(id)
  if (!goal) {
    return false
  }

  try {
    await repo.deleteGoalCascadeAtomic(id)

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[goal.commands] Failed to delete goal", error)
    toast.error(failureMessage ?? "Failed to delete goal.")
    return false
  }
}
