import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { getUpcomingTriggerDateKeys } from "@/utils/trigger-evaluation"
import { isTaskFinished } from "./internal/planning-helpers"

/**
 * A task's predicted trigger pull-ups over the horizon. UI PROJECTION, not
 * planner authority: the planner only ever plans "today" (a fire recorded in
 * trigger state → step 2b), while this extrapolates the fire rule forward.
 * The contract test (projection.test.ts) pins the prediction to the actual
 * fire mechanism (`getPendingTriggerDateKey`), so the two read from one rule.
 */
export interface TaskTriggerProjection {
  /** True when the pull-up comes from the goal's trigger (domain invariant:
   * such goals force their tasks single-run, so the two are exclusive). */
  byGoalTrigger: boolean
  /** The rule that produces the fires (the goal's or the task's own). */
  rule: triggerRule
  fires: LocalDateKey[]
}

/**
 * Single source for "when will a trigger pull this task up": a task is
 * goal-triggered iff its goal has a trigger, otherwise its own `task.trigger`
 * (with its validity window) applies. Finished tasks project nothing.
 */
export function projectUpcomingTriggerFires(params: {
  task: TaskGroupEntity
  goal: GoalEntity | undefined
  now: Date
  days: number
}): TaskTriggerProjection | null {
  const { task, goal, now, days } = params
  if (isTaskFinished(task)) return null

  const goalTrigger = goal?.trigger
  if (goalTrigger != null) {
    return {
      byGoalTrigger: true,
      rule: goalTrigger.rule,
      fires: getUpcomingTriggerDateKeys({
        rule: goalTrigger.rule,
        anchor: goal!.createdAt,
        now,
        days,
      }),
    }
  }

  if (task.trigger != null) {
    return {
      byGoalTrigger: false,
      rule: task.trigger.rule,
      fires: getUpcomingTriggerDateKeys({
        rule: task.trigger.rule,
        anchor: task.trigger.startsAt ?? task.createdAt,
        now,
        days,
        windowStart: task.trigger.startsAt,
        windowEnd: task.trigger.endsAt,
      }),
    }
  }

  return null
}
