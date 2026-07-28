import { toast } from "sonner"

import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import {
  createStableActivityId,
  createStableRepeatResolutionActivityId,
} from "@/domain/entities/ActivityEntity"
import type { RepeatPointStatus } from "@/domain/entities/RepeatLedgerEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { ActivityID, TaskRuntimeID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import * as repo from "@/persistence/repository"
import { buildRepeatSkipMutation } from "@/persistence/run-mutations"
import { useAppStore } from "@/store/app-store"
import { createTaskRuntimeId } from "@/utils/task-runtime"

function scheduleReplan(): Promise<void> {
  return Promise.resolve(useAppStore.getState().replan("partial"))
}

const TASK_DONE_ID_PREFIX = "act::task-done::"

// Every command here lands its whole write-set through ONE applyRunMutation:
// the activity/ledger records, any run retraction, and the completedCount
// recompute commit together or not at all. `completedCount` itself is never
// touched directly — it is a projection recomputed from the records via
// `recomputeCompletedCountFor`, the single source of truth shared with the
// runtime completion path.

// ── counter / trigger completion records (Activity-backed) ──

export async function addCompletionRecord(
  task: TaskGroupEntity,
  date: LocalDateKey,
  failureMessage?: string
): Promise<boolean> {
  try {
    const activity: ActivityEntity = {
      id: `act::task-done::manual::${task.id}::${crypto.randomUUID()}` as ActivityID,
      kind: "task-done",
      taskId: task.id,
      goalId: task.goalId,
      runtimeId: `manual::${task.id}::${date}` as TaskRuntimeID,
      recordedDateKey: date,
      recordedAt: new Date(),
      taskTitleSnapshot: task.title,
    }
    await repo.applyRunMutation({
      putActivities: [activity],
      recomputeCompletedCountFor: [task.id],
    })
    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[completion.commands] addCompletionRecord failed", error)
    toast.error(failureMessage ?? "Failed to add completion record.")
    return false
  }
}

export async function removeCompletionRecord(
  task: TaskGroupEntity,
  activityId: ActivityID,
  failureMessage?: string
): Promise<boolean> {
  try {
    // If the record came from a runtime finishing (stable id
    // `act::task-done::<runtimeId>`), that run is still `done` in dayRuns —
    // its "undo" would then decrement completedCount a second time. Retract it
    // in the same transaction. Ids that encode no live run (manual /
    // repeat-resolution records) simply miss the in-tx lookup.
    const retractRunId = activityId.startsWith(TASK_DONE_ID_PREFIX)
      ? (activityId.slice(TASK_DONE_ID_PREFIX.length) as TaskRuntimeID)
      : undefined
    await repo.applyRunMutation({
      deleteActivityIds: [activityId],
      retractDoneRunIds: retractRunId ? [retractRunId] : undefined,
      recomputeCompletedCountFor: [task.id],
    })
    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[completion.commands] removeCompletionRecord failed", error)
    toast.error(failureMessage ?? "Failed to remove completion record.")
    return false
  }
}

export async function updateCompletionRecordDate(
  activityId: ActivityID,
  date: LocalDateKey,
  failureMessage?: string
): Promise<boolean> {
  try {
    await repo.patchActivityDate(activityId, date)
    await scheduleReplan()
    return true
  } catch (error) {
    console.error(
      "[completion.commands] updateCompletionRecordDate failed",
      error
    )
    toast.error(failureMessage ?? "Failed to update completion record.")
    return false
  }
}

// ── repeat ledger point status ──

export async function setRepeatPointStatus(
  task: TaskGroupEntity,
  dateKey: LocalDateKey,
  status: RepeatPointStatus,
  failureMessage?: string
): Promise<boolean> {
  try {
    const resolutionActivityId = createStableRepeatResolutionActivityId(
      "task-done",
      task.id,
      dateKey
    )
    const mutation: repo.RunMutation = {
      ledgerMarks: [{ taskId: task.id, dateKey, status }],
      recomputeCompletedCountFor: [task.id],
    }

    if (status === "completed") {
      mutation.putActivities = [
        {
          id: resolutionActivityId,
          kind: "task-done",
          taskId: task.id,
          goalId: task.goalId,
          runtimeId: `manual::${task.id}::${dateKey}` as TaskRuntimeID,
          plannedForDate: dateKey,
          recordedDateKey: dateKey,
          recordedAt: new Date(),
          taskTitleSnapshot: task.title,
        },
      ]
    } else {
      // The point may have been completed through its runtime, which recorded
      // under the runtime-derived stable id and left a `done` runtime behind —
      // clean up both, or the header's undo would double-retract.
      const pointRuntimeId = createTaskRuntimeId(task.id, "repeatPolicy", dateKey)
      mutation.deleteActivityIds = [
        resolutionActivityId,
        createStableActivityId("task-done", pointRuntimeId),
      ]
      if (status === "skipped") {
        // Skip semantics own the run teardown (and the skip record).
        const run = await repo.queryDayRun(pointRuntimeId)
        if (run) {
          const skip = buildRepeatSkipMutation(run, task, new Date())
          mutation.deleteRunIds = skip.deleteRunIds
          mutation.putActivities = skip.putActivities
          // The ledger mark above already says "skipped" — identical to the
          // skip builder's, so no second mark is needed.
        }
      } else {
        mutation.retractDoneRunIds = [pointRuntimeId]
      }
    }

    await repo.applyRunMutation(mutation)
    await scheduleReplan()
    return true
  } catch (error) {
    console.error("[completion.commands] setRepeatPointStatus failed", error)
    toast.error(failureMessage ?? "Failed to update repeat point.")
    return false
  }
}
