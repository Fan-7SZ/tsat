import type { Dictionary } from "@/i18n/types"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import { areRunsInterchangeable } from "@/utils/task-runtime"

/**
 * The subset of a today-item VM the multi-item display rules touch. Both the
 * Home and My-Tasks VMs satisfy this, so these rules live here once rather than
 * being copied per page — copying them is exactly what let the two pages drift.
 */
export interface DayItemLike {
  taskId: TaskID
  runtimeId: TaskRuntimeID
  plannedForLabel?: string
  runsLabel?: string
  isDebtItem?: boolean
  collapsedRunIds?: TaskRuntimeID[]
}

function groupByTask<T extends DayItemLike>(items: T[]): Map<TaskID, T[]> {
  const byTask = new Map<TaskID, T[]>()
  for (const item of items) {
    byTask.set(item.taskId, [...(byTask.get(item.taskId) ?? []), item])
  }
  return byTask
}

/**
 * Open items (todo / inProgress) stay as separate rows — each is a distinct
 * piece of work — but two rows of the same task read as a duplicate, so a task
 * with several gets an ordinal. Repeat items already say which day they serve,
 * so they keep that instead.
 */
export function ordinaliseOpenItems<T extends DayItemLike>(
  items: T[],
  t: Dictionary
): T[] {
  const byTask = groupByTask(items)
  return items.map((item) => {
    const siblings = byTask.get(item.taskId)!
    if (siblings.length < 2 || item.plannedForLabel) return item
    return {
      ...item,
      runsLabel: t.actions.runOrdinal(siblings.indexOf(item) + 1),
    }
  })
}

/**
 * Finished items collapse to one row carrying a count: nobody cares which of
 * today's three completions was which.
 *
 * `collapsedRunIds` is set only when the items are NOT interchangeable — it is
 * the "this row needs the runs dialog" signal. When they are (a counter task run
 * twice by hand), retracting any one does the same thing, so the row keeps a
 * single runtimeId and acts directly. Either way a single item's date / debt
 * badge no longer applies, so it is cleared in favour of the "done Nx" count.
 */
export function collapseDoneItems<T extends DayItemLike>(
  items: T[],
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>,
  t: Dictionary
): T[] {
  return [...groupByTask(items).values()].map((group) => {
    const first = group[0]!
    if (group.length < 2) return first

    const runs = group
      .map((item) => taskRuntime[item.runtimeId])
      .filter((runtime): runtime is TaskRuntimeEntity => runtime != null)

    return {
      ...first,
      // Act on the most recent item; they are equivalent, but retracting the
      // latest is what "undo" means to a user.
      runtimeId: group[group.length - 1]!.runtimeId,
      runsLabel: t.actions.runsDoneToday(group.length),
      plannedForLabel: undefined,
      isDebtItem: false,
      // A runtime record missing from the store means interchangeability can't
      // be proven — route through the runs dialog instead of acting directly.
      collapsedRunIds:
        runs.length === group.length && areRunsInterchangeable(runs)
          ? undefined
          : group.map((item) => item.runtimeId),
    }
  })
}
