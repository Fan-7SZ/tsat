import { useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import { db } from "@/persistence/db"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskRuntimeStatus } from "@/domain/entities/TaskRuntimeEntity"
import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import { aggregateRuntimeStatus } from "@/utils/task-runtime"

/** Stable empty map for callers that don't care about the loading frame. */
export const EMPTY_DAY_RUN_MAP: Record<TaskRuntimeID, DayRunEntity> = {}

/**
 * Live map of every dayRuns row, keyed by run id — the drop-in replacement for
 * the old zustand `taskRuntime` record (DayRunEntity extends TaskRuntimeEntity,
 * so existing pure helpers accept it unchanged). Returns `undefined` while the
 * first query resolves so callers can render a loading state instead of
 * flashing "no runs" (the TaskDetail header did exactly that); callers that
 * don't care fall back with `?? EMPTY_DAY_RUN_MAP`.
 */
export function useDayRunMap(
  /**
   * Optional route-loader rows covering the frame before the live query first
   * resolves — callers with a loader never see the `undefined` frame.
   */
  initialRows?: DayRunEntity[]
): Record<TaskRuntimeID, DayRunEntity> | undefined {
  const rows = useLiveQuery(() => db.dayRuns.toArray(), [])
  return useMemo(() => {
    const source = rows ?? initialRows
    return source
      ? (Object.fromEntries(source.map((row) => [row.id, row])) as Record<
          TaskRuntimeID,
          DayRunEntity
        >)
      : undefined
  }, [rows, initialRows])
}

/** One-shot fetch of all dayRuns rows for route loaders. */
export function fetchDayRunRows(): Promise<DayRunEntity[]> {
  return db.dayRuns.toArray()
}

/**
 * Aggregate runtime status of one task's runs (sidebar rows etc.). Scoped to a
 * per-task query so a row only re-renders when its own task's runs change.
 */
export function useTaskAggregateRunStatus(
  taskId: TaskID
): TaskRuntimeStatus | undefined {
  const rows = useLiveQuery(
    () => db.dayRuns.where("taskId").equals(taskId).toArray(),
    [taskId]
  )
  return useMemo(() => {
    if (!rows || rows.length === 0) return undefined
    const map = Object.fromEntries(rows.map((row) => [row.id, row]))
    return aggregateRuntimeStatus(map, taskId)
  }, [rows, taskId])
}
