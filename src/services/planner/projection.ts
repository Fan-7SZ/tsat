import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import { toLocalDateKey } from "@/utils/date"
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
 * (with its validity window) applies.
 *
 * A finished task gates the two mechanisms differently, because they disagree on
 * what "finished" means (PLAN.md §6, trigger reset):
 * - **goal trigger**: every fire starts a NEW round — the reset drops the
 *   previous rounds' completion records and re-derives the counter — so a
 *   finished task is finished for TODAY only. It leaves today's fire and keeps
 *   every later one; killing the whole forecast here is what made a completed
 *   trigger goal blank out the entire pressure window.
 * - **task trigger**: progress is cumulative (the fire records only
 *   `lastTriggeredDateKey` and never touches the counter), so a finished task is
 *   finished for good and projects nothing.
 */
export function projectUpcomingTriggerFires(params: {
  task: TaskGroupEntity
  goal: GoalEntity | undefined
  now: Date
  days: number
}): TaskTriggerProjection | null {
  const { task, goal, now, days } = params

  const goalTrigger = goal?.trigger
  if (goalTrigger != null) {
    const fires = getUpcomingTriggerDateKeys({
      rule: goalTrigger.rule,
      anchor: goal!.createdAt,
      now,
      days,
    })
    const todayKey = toLocalDateKey(now)
    return {
      byGoalTrigger: true,
      rule: goalTrigger.rule,
      fires: isTaskFinished(task)
        ? fires.filter((dateKey) => dateKey !== todayKey)
        : fires,
    }
  }

  if (task.trigger != null) {
    if (isTaskFinished(task)) return null
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
