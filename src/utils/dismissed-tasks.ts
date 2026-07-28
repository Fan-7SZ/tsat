import type { DismissedTaskRecord } from "@/domain/entities/IntentRecord"
import type { TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

/**
 * The day-scoped semantics of a dismissal live HERE: a record only suppresses
 * its task on the day it was written. Every consumer (hooks, planner, VM
 * assembly) must select through this filter — records from earlier days are
 * inert and merely await GC.
 */
export function selectTodayDismissedTaskIds(
  records: Iterable<DismissedTaskRecord>,
  todayKey: LocalDateKey
): Set<TaskID> {
  const ids = new Set<TaskID>()
  for (const record of records) {
    if (record.dateKey === todayKey) ids.add(record.taskId)
  }
  return ids
}
