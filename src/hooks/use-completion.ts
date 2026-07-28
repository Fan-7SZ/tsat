import { useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import type {
  CompletionRecordRow,
  RepeatPointRow,
} from "@/components/task/CompletionRecordsDialog"
import type { TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { db } from "@/persistence/db"
import { queryActivitiesByTask } from "@/persistence/repository"

/** Completion records for a counter / trigger task = its task-done activities. */
export function useTaskCompletionRecords(
  taskId: TaskID | undefined
): CompletionRecordRow[] {
  const activities = useLiveQuery(
    () => (taskId ? queryActivitiesByTask(taskId) : []),
    [taskId]
  )

  return useMemo(
    () =>
      (activities ?? [])
        .filter((a) => a.kind === "task-done")
        .map((a) => ({ id: a.id, date: a.recordedDateKey }))
        .sort((left, right) => left.date.localeCompare(right.date)),
    [activities]
  )
}

/** Planned points + status for a repeat task, read live from the ledger. */
export function useTaskRepeatLedger(
  taskId: TaskID | undefined
): RepeatPointRow[] {
  const ledger = useLiveQuery(
    () => (taskId ? db.repeatLedgers.get(taskId) : undefined),
    [taskId]
  )

  return useMemo(
    () =>
      ledger
        ? Object.entries(ledger.points)
            .map(([dateKey, status]) => ({
              dateKey: dateKey as LocalDateKey,
              status,
            }))
            .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
        : [],
    [ledger]
  )
}
