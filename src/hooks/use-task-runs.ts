import { useMemo } from "react"
import { format } from "date-fns"

import type { TaskID } from "@/domain/value-objects/types"
import type { TaskRunRow } from "@/components/task/TaskRunsDialog"
import { EMPTY_DAY_RUN_MAP, useDayRunMap } from "@/hooks/use-day-runs"
import { useLanguage } from "@/components/shared/language-provider"
import {
  areRunsInterchangeable,
  getRuntimePlannedForDate,
  getTaskRuntimeEntries,
} from "@/utils/task-runtime"
import { parseDateKey, toLocalDateKey } from "@/utils/date"

/**
 * Today's items for a task, shaped for {@link TaskRunsDialog}.
 *
 * `interchangeable` decides whether the dialog is needed at all: when every item
 * would behave identically, asking the user to pick one is a meaningless choice
 * and the caller should just act on one directly.
 *
 * Each row's `trailing` mirrors the affordance that item has *elsewhere* in the
 * app, so the dialog speaks the same language as the rest of the UI rather than
 * inventing a generic delete:
 * - a repeat debt point → the debt popover (resolve / ignore),
 * - today's repeat point → skip,
 * - anything else (a counter item) → remove from today.
 */
export function useTaskRuns(taskId: TaskID | null): {
  rows: TaskRunRow[]
  interchangeable: boolean
} {
  const taskRuntime = useDayRunMap() ?? EMPTY_DAY_RUN_MAP
  const { t } = useLanguage()

  return useMemo(() => {
    if (!taskId) return { rows: [], interchangeable: true }

    const todayKey = toLocalDateKey(new Date())
    const runs = getTaskRuntimeEntries(taskRuntime, taskId)
    const rows = runs.map((runtime, index): TaskRunRow => {
      const plannedForDate = getRuntimePlannedForDate(runtime)
      const trailing: TaskRunRow["trailing"] = plannedForDate
        ? plannedForDate < todayKey
          ? { kind: "debt", plannedForDate }
          : { kind: "skip" }
        : { kind: "remove" }

      return {
        runtimeId: runtime.id,
        label: plannedForDate
          ? t.tasks.planOn(format(parseDateKey(plannedForDate), "MMM d"))
          : runtime.source
            ? t.runtimeSource[runtime.source]
            : t.actions.runOrdinal(index + 1),
        status: runtime.arrangementStatus,
        trailing,
      }
    })

    return { rows, interchangeable: areRunsInterchangeable(runs) }
  }, [taskId, taskRuntime, t])
}
