import { useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { format } from "date-fns"
import { useGoalMap, useTaskMap } from "@/hooks/use-entities"
import type { ActivityEntity } from "@/domain/entities/ActivityEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { RepeatLedgerEntity } from "@/domain/entities/RepeatLedgerEntity"
import type {
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type { ActivityLogItemVM } from "@/domain/view-models/HomePageVM"
import type { GoalDetailActivityItemVM } from "@/domain/view-models/GoalDetailPageVM"
import type { TaskDetailHistoryItemVM } from "@/domain/view-models/TaskDetailPageVM"
import type { TasksTaskItemVM } from "@/domain/view-models/TasksPageVM"
import { useLanguage } from "@/components/shared/language-provider"
import { createTaskRuntimeId } from "@/utils/task-runtime"
import { parseDateKey } from "@/utils/date"
import {
  queryActivitiesByGoal,
  queryActivitiesByTask,
  queryAllActivities,
  queryAllRepeatLedgers,
  queryRecentActivities,
} from "@/persistence/repository"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

/**
 * The day each in-progress run was started, keyed by runtime id.
 *
 * A runtime carries no timestamp of its own, but entering `inProgress` writes a
 * `task-in-progress` activity (removed again when it goes back to `todo`), so
 * that activity *is* the run's start time. This is what identifies a run that
 * was carried across the day boundary: only in-progress runs survive the sweep,
 * and every one of them has this record.
 */
export function useRunStartDates(
  /** Route-loader activities snapshot for the pre-first-resolution frame. */
  initial?: ActivityEntity[]
): Record<TaskRuntimeID, LocalDateKey> {
  const activities = useLiveQuery(() => queryAllActivities(), [])

  return useMemo(() => {
    const startDates: Record<TaskRuntimeID, LocalDateKey> = {}
    for (const activity of activities ?? initial ?? []) {
      if (activity.kind !== "task-in-progress") continue
      startDates[activity.runtimeId] = activity.recordedDateKey
    }
    return startDates
  }, [activities, initial])
}

export function useRecentActivities(
  limit = 10,
  initial?: ActivityEntity[]
): ActivityLogItemVM[] {
  const activities = useLiveQuery(() => queryRecentActivities(limit), [limit])

  return useMemo(
    () =>
      (activities ?? initial ?? []).map((a) => {
        return {
          id: a.id,
          kind: a.kind,
          taskId: a.taskId,
          taskTitle: a.taskTitleSnapshot,
          recordedAtLabel: format(a.recordedAt, "PP"),
        }
      }),
    [activities, initial]
  )
}

export function useGoalActivities(
  goalId: GoalID | undefined,
  limit = 10
): GoalDetailActivityItemVM[] {
  const activities = useLiveQuery(
    () => (goalId ? queryActivitiesByGoal(goalId, limit) : []),
    [goalId, limit]
  )

  return useMemo(
    () =>
      (activities ?? []).map((a) => {
        return {
          id: a.id,
          kind: a.kind,
          taskId: a.taskId,
          taskTitle: a.taskTitleSnapshot,
          recordedAtLabel: format(a.recordedAt, "PP"),
        }
      }),
    [activities]
  )
}

export function useTaskActivities(
  taskId: TaskID | undefined
): TaskDetailHistoryItemVM[] {
  const activities = useLiveQuery(
    () => (taskId ? queryActivitiesByTask(taskId) : []),
    [taskId]
  )

  return useMemo(
    () =>
      (activities ?? []).map((a) => {
        return {
          id: a.id,
          kind: a.kind,
          taskId: a.taskId,
          taskTitle: a.taskTitleSnapshot,
          recordedAtLabel: format(a.recordedAt, "PP"),
        }
      }),
    [activities]
  )
}

/**
 * Skipped repeat occurrences, read from the authoritative source — the repeat
 * ledger's `skipped` points — rather than from repeat-skip activities, which
 * not every skip path writes (e.g. the detail-page calendar marks the ledger
 * only). One row per task: a single skipped point carries its date as the
 * badge; several collapse into a "skipped N times" count, mirroring how done
 * runs collapse. `runtimeId`/`plannedForDate` target the most recent point, so
 * restore peels skips off newest-first.
 */
export interface SkippedRepeatTaskVM extends TasksTaskItemVM {
  /** Every ledger date skipped for this task, ascending. */
  skippedDates: LocalDateKey[]
}

export function useSkippedRepeatTasks(initial?: {
  goals?: GoalEntity[]
  tasks?: TaskGroupEntity[]
  repeatLedgers?: RepeatLedgerEntity[]
}): SkippedRepeatTaskVM[] {
  const taskMap = useTaskMap(initial?.tasks)
  const goalMap = useGoalMap(initial?.goals)
  const { t } = useLanguage()

  const liveLedgers = useLiveQuery(() => queryAllRepeatLedgers(), [])

  return useMemo(() => {
    const ledgers = liveLedgers ?? initial?.repeatLedgers
    if (!ledgers || ledgers.length === 0) return []

    return ledgers.flatMap((ledger) => {
      const task = taskMap[ledger.taskId]
      if (!task || task.repeat == null) return []

      const skippedDates = (Object.keys(ledger.points) as LocalDateKey[])
        .filter((dateKey) => ledger.points[dateKey] === "skipped")
        .sort()
      if (skippedDates.length === 0) return []

      const latest = skippedDates[skippedDates.length - 1]!
      const runtimeId = createTaskRuntimeId(task.id, "repeatPolicy", latest)

      return [
        {
          runtimeId: runtimeId as TaskRuntimeID,
          taskId: task.id,
          title: task.title,
          goalId: task.goalId ?? undefined,
          goalTitle: task.goalId ? goalMap[task.goalId]?.title : undefined,
          bucket: "todo" as const,
          runtimeStatus: null,
          runtimeSource: "repeatPolicy" as const,
          steps:
            task.steps?.map((s) => ({
              id: s.id,
              title: s.title,
              done: false,
            })) ?? [],
          dueAt: task.dueAt ? format(task.dueAt, "PP") : undefined,
          dueAtRaw: task.dueAt ?? undefined,
          estimatedDuration: task.estimatedDuration,
          isForced: false,
          isRepeatTask: true,
          plannedForDate: latest,
          plannedForLabel:
            skippedDates.length === 1
              ? t.tasks.skippedPlan(format(parseDateKey(latest), "MMM d"))
              : undefined,
          runsLabel:
            skippedDates.length > 1
              ? t.tasks.skippedTimes(skippedDates.length)
              : undefined,
          skippedDates,
        } satisfies SkippedRepeatTaskVM,
      ]
    })
  }, [liveLedgers, initial?.repeatLedgers, goalMap, taskMap, t])
}
