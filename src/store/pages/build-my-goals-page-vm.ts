import { format } from "date-fns"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { GoalFocus } from "@/domain/derived/GoalFocus"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { FocusQuotaVM } from "@/domain/view-models/HomePageVM"
import type { MyGoalsPageVM } from "@/domain/view-models/MyGoalsPageVM"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import {
  hasBlockingGoalFocusStatus,
  normalizeGoalFocus,
} from "@/utils/goal-focus-status"
import { isGoalDone } from "@/utils/goal-done"
import { computeGoalCompletionCounts } from "@/utils/goal-progress"

type BuildMyGoalsPageVMInput = {
  goals: Record<GoalID, GoalEntity>
  tasks: Record<TaskID, TaskGroupEntity>
  goalFocus: Record<GoalID, GoalFocus>
  maxFocusGoals: number
}

export function buildMyGoalsPageVM({
  goals,
  tasks,
  goalFocus,
  maxFocusGoals,
}: BuildMyGoalsPageVMInput): MyGoalsPageVM {
  const items = Object.values(goals).map((goal) => {
    const runtime = normalizeGoalFocus(goal.id, goalFocus[goal.id])
    const focusStatuses = runtime.focusStatuses
    const { completedCount, totalCount } = computeGoalCompletionCounts(
      goal.id,
      tasks
    )

    return {
      goal,
      isDone: isGoalDone(goal.id, tasks),
      completedCount,
      totalCount,
      dueLabel: goal.dueAt ? format(goal.dueAt, "PP") : undefined,
      isFocused: runtime.isFocused || focusStatuses.length > 0,
      isForced: hasBlockingGoalFocusStatus(focusStatuses),
      focusStatuses,
    }
  })

  let focusedCount = 0
  let forcedFocusedCount = 0
  for (const item of items) {
    if (!item.isFocused) {
      continue
    }

    focusedCount += 1
    if (item.isForced) {
      forcedFocusedCount += 1
    }
  }

  const focusQuota: FocusQuotaVM = {
    focusedCount,
    forcedFocusedCount,
    maxFocusGoals,
  }

  return {
    inProgress: items.filter((item) => !item.isDone),
    done: items.filter((item) => item.isDone),
    focusQuota,
  }
}
