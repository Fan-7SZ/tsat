import { toast } from "sonner"

import type { TaskTriggerConfig } from "@/domain/entities/TaskGroupEntity"
import type { TaskID } from "@/domain/value-objects/types"
import * as repo from "@/persistence/repository"
import { useAppStore } from "@/store/app-store"
import { validateTriggerWindowConfiguration } from "@/utils/repeat-validation"

function scheduleReplan(): Promise<void> {
  return Promise.resolve(useAppStore.getState().replan("partial"))
}

function toastSetResult(result: repo.SetTaskTriggerAtomicResult): void {
  if (result === "repeat-task") {
    toast.error("Repeating tasks cannot use a trigger.")
  } else if (result === "task-not-found") {
    toast.error("Task not found.")
  }
}

export async function saveTaskTrigger(
  taskId: TaskID,
  trigger: TaskTriggerConfig,
  failureMessage?: string
): Promise<boolean> {
  try {
    const task = await repo.queryTaskById(taskId)
    if (!task) {
      toast.error(failureMessage ?? "Task not found.")
      return false
    }

    const [goal, dependency, goalTasks] = task.goalId
      ? await Promise.all([
          repo.queryGoalById(task.goalId),
          repo.queryDependencyByGoal(task.goalId),
          repo.queryTasksByGoal(task.goalId),
        ])
      : [null, null, []]

    const validation = validateTriggerWindowConfiguration({
      window: trigger,
      goal: goal ?? undefined,
      fallbackStart: task.createdAt,
      dependency,
      currentNodeData: task.id,
      tasksById: Object.fromEntries(
        goalTasks.map((goalTask) => [goalTask.id, goalTask])
      ),
    })

    if (validation.error) {
      toast.error(validation.error.message)
      return false
    }

    const result = await repo.setTaskTriggerAtomic(taskId, trigger)

    if (result !== "saved") {
      toastSetResult(result)
      return false
    }

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[task-trigger.commands] Failed to save trigger", error)
    toast.error(failureMessage ?? "Failed to save trigger.")
    return false
  }
}

export async function deleteTaskTrigger(
  taskId: TaskID,
  failureMessage?: string
): Promise<boolean> {
  try {
    const result = await repo.deleteTaskTriggerAtomic(taskId)
    if (result !== "deleted") {
      toast.error(failureMessage ?? "Task not found.")
      return false
    }

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[task-trigger.commands] Failed to delete trigger", error)
    toast.error(failureMessage ?? "Failed to delete trigger.")
    return false
  }
}
