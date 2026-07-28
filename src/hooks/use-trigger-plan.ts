import { useMemo } from "react"

import { useAllGoals, useAllTasks } from "@/hooks/use-entities"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import { useLanguage } from "@/components/shared/language-provider"
import {
  buildTriggerPlanItems,
  type TriggerPlanItemVM,
} from "@/store/pages/build-trigger-plan-items"

/**
 * Live list of tasks that a trigger will pull up within the next two weeks,
 * grouped per task. Backed by the Dexie liveQuery goal/task maps, so it updates
 * whenever a trigger rule or validity window changes.
 */
export function useTriggerPlanItems(initial?: {
  goals?: GoalEntity[]
  tasks?: TaskGroupEntity[]
}): TriggerPlanItemVM[] {
  const goals = useAllGoals(initial?.goals)
  const tasks = useAllTasks(initial?.tasks)
  const { t } = useLanguage()

  return useMemo(
    () => buildTriggerPlanItems({ goals, tasks, now: new Date(), t }),
    [goals, tasks, t]
  )
}
