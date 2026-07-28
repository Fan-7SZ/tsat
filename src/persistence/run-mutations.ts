import {
  type ActivityEntity,
  createStableActivityId,
} from "@/domain/entities/ActivityEntity"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import { isRepeatRuntime } from "@/utils/task-runtime"
import { toLocalDateKey } from "@/utils/date"
import type { RunMutation } from "./repository"

/**
 * The skip write-set for a live repeat run: drop the run, record the skip, and
 * mark the ledger point. Single source for skip semantics — consumed by both
 * the runs slice (`skipRepeatTask`) and the repeat-point command
 * (`setRepeatPointStatus`), so the two entry points cannot drift.
 */
export function buildRepeatSkipMutation(
  runtime: DayRunEntity,
  task: TaskGroupEntity | null,
  now: Date
): RunMutation {
  const mutation: RunMutation = { deleteRunIds: [runtime.id] }
  if (!task) return mutation

  const plannedForDate = isRepeatRuntime(runtime)
    ? runtime.plannedForDate
    : undefined

  const skipActivity: ActivityEntity = {
    id: createStableActivityId("repeat-skip", runtime.id),
    kind: "repeat-skip",
    taskId: task.id,
    goalId: task.goalId,
    runtimeId: runtime.id,
    plannedForDate,
    recordedDateKey: toLocalDateKey(now),
    recordedAt: now,
    taskTitleSnapshot: task.title,
  }
  mutation.putActivities = [skipActivity]
  if (plannedForDate) {
    mutation.ledgerMarks = [
      { taskId: task.id, dateKey: plannedForDate, status: "skipped" },
    ]
  }
  return mutation
}
