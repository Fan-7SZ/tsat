import { toast } from "sonner"

import type {
  GoalEntity,
  GoalTriggerConfig,
} from "@/domain/entities/GoalEntity"
import type { GoalID } from "@/domain/value-objects/types"
import * as repo from "@/persistence/repository"
import { useAppStore } from "@/store/app-store"

function scheduleReplan(): Promise<void> {
  return Promise.resolve(useAppStore.getState().replan("partial"))
}

function toastSetResult(result: repo.SetGoalTriggerAtomicResult): void {
  if (result === "repeat-tasks") {
    toast.error("Triggered goals cannot contain repeating tasks.")
  } else if (result === "goal-not-found") {
    toast.error("Goal not found.")
  }
}

export async function saveGoalTrigger(
  goalId: GoalID,
  trigger: GoalTriggerConfig,
  failureMessage?: string
): Promise<boolean> {
  try {
    const result = await repo.setGoalTriggerAtomic(goalId, trigger)

    if (result !== "saved") {
      toastSetResult(result)
      return false
    }

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[trigger.commands] Failed to save trigger", error)
    toast.error(failureMessage ?? "Failed to save trigger.")
    return false
  }
}

/**
 * Enable a goal trigger after normalizing any task that is not single-run
 * (total !== 1, or has a repeat / trigger rule). The DB changes — resetting the
 * tasks and clearing their repeat ledgers + trigger states — happen atomically;
 * this command additionally drops the affected tasks' in-memory runtime entries
 * (mirroring deleteTask) and replans once.
 */
export async function saveGoalTriggerWithTaskNormalization(
  goalId: GoalID,
  trigger: GoalTriggerConfig,
  failureMessage?: string
): Promise<boolean> {
  try {
    const { result, normalizedTaskIds } =
      await repo.setGoalTriggerWithTaskNormalizationAtomic(goalId, trigger)

    if (result !== "saved") {
      toast.error(failureMessage ?? "Failed to save trigger.")
      return false
    }

    if (normalizedTaskIds.length > 0) {
      await repo.deleteDayRunsByTasks(normalizedTaskIds)
    }

    await scheduleReplan()
    return true
  } catch (error) {
    console.error(
      "[trigger.commands] Failed to save trigger with normalization",
      error
    )
    toast.error(failureMessage ?? "Failed to save trigger.")
    return false
  }
}

export async function createGoalWithTrigger(
  goal: GoalEntity,
  trigger: GoalTriggerConfig,
  failureMessage?: string
): Promise<boolean> {
  try {
    const result = await repo.createGoalWithTriggerAtomic({
      ...goal,
      trigger,
    })

    if (result !== "created") {
      toast.error(failureMessage ?? "Failed to create triggered goal.")
      return false
    }

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[trigger.commands] Failed to create triggered goal", error)
    toast.error(failureMessage ?? "Failed to create triggered goal.")
    return false
  }
}

export async function deleteGoalTrigger(
  goalId: GoalID,
  failureMessage?: string
): Promise<boolean> {
  try {
    const result = await repo.deleteGoalTriggerAtomic(goalId)
    if (result !== "deleted") {
      toast.error(failureMessage ?? "Goal not found.")
      return false
    }

    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[trigger.commands] Failed to delete trigger", error)
    toast.error(failureMessage ?? "Failed to delete trigger.")
    return false
  }
}
