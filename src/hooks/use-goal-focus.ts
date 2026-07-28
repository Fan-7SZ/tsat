import { useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import { db } from "@/persistence/db"
import type { GoalFocus } from "@/domain/derived/GoalFocus"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { DayRunEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { ManualFocusRecord } from "@/domain/entities/IntentRecord"
import type { GoalID } from "@/domain/value-objects/types"
import { deriveGoalFocus } from "@/services/planner/derive-goal-focus"
import { EMPTY_DAY_RUN_MAP, useDayRunMap } from "@/hooks/use-day-runs"
import { useGoalMap, useTaskMap } from "@/hooks/use-entities"
import { useAppStore } from "@/store/app-store"

/**
 * Goal focus, derived live from the authoritative facts (goals / tasks /
 * dayRuns / manualFocuses / policy). Nothing is stored: focus is an
 * interpretation of the data — see deriveGoalFocus.
 */
export function useGoalFocusMap(initial?: {
  goals?: GoalEntity[]
  tasks?: TaskGroupEntity[]
  dayRuns?: DayRunEntity[]
  manualFocuses?: ManualFocusRecord[]
}): Record<GoalID, GoalFocus> {
  const goals = useGoalMap(initial?.goals)
  const tasks = useTaskMap(initial?.tasks)
  const taskRuntime = useDayRunMap(initial?.dayRuns) ?? EMPTY_DAY_RUN_MAP
  const manualFocusRows = useLiveQuery(() => db.manualFocuses.toArray(), [])
  const policy = useAppStore((s) => s.policy)

  return useMemo(() => {
    const manualFocuses = Object.fromEntries(
      (manualFocusRows ?? initial?.manualFocuses ?? []).map((row) => [
        row.goalId,
        row,
      ])
    ) as Record<GoalID, ManualFocusRecord>
    return deriveGoalFocus({
      goals,
      tasks,
      taskRuntime,
      manualFocuses,
      policy,
      now: new Date(),
    })
  }, [goals, tasks, taskRuntime, manualFocusRows, initial?.manualFocuses, policy])
}

/** One-shot fetch of manual focus rows for route loaders. */
export function fetchManualFocusRows(): Promise<ManualFocusRecord[]> {
  return db.manualFocuses.toArray()
}
