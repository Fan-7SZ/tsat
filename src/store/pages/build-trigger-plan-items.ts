import { format } from "date-fns"

import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import type { Dictionary } from "@/i18n/types"
import { projectUpcomingTriggerFires } from "@/services/planner/projection"
import { summarizeTriggerRule } from "@/utils/rule-summary"
import { parseDateKey, toLocalDateKey } from "@/utils/date"

/** Upcoming pull-up window, in days. */
const PULL_UP_WINDOW_DAYS = 14

export interface TriggerPullUpVM {
  key: LocalDateKey
  label: string
}

export interface TriggerPlanItemVM {
  taskId: TaskID
  title: string
  goalId?: GoalID
  goalTitle: string
  byGoalTrigger: boolean
  /** Localized cadence summary for the pull-up info popover. */
  ruleSummary: string
  /** Localized validity window (task triggers with a start–end window). */
  windowLabel?: string
  pullUps: TriggerPullUpVM[]
}

export interface TriggerPlanSource {
  goals: GoalEntity[]
  tasks: TaskGroupEntity[]
  now: Date
  t: Dictionary
}

/**
 * Builds the "By Trigger" list: tasks that will be pulled up by a trigger within
 * the next two weeks (today excluded — today's firing is the Today tab's job).
 *
 * A goal with a trigger forces its tasks to be plain single-run tasks (a domain
 * invariant), so a task is goal-triggered iff its goal has a trigger, and only
 * non-goal-triggered tasks carry their own `task.trigger`. Each task aggregates
 * its multiple fire dates into one stacked item.
 */
export function buildTriggerPlanItems(
  source: TriggerPlanSource
): TriggerPlanItemVM[] {
  const { goals, tasks, now, t } = source
  const todayKey = toLocalDateKey(now)

  const goalsById = new Map(goals.map((goal) => [goal.id, goal]))

  const toLabel = (key: LocalDateKey): string =>
    format(parseDateKey(key), "MMM d (EEE)")

  const items: TriggerPlanItemVM[] = []

  for (const task of tasks) {
    const goal = task.goalId ? goalsById.get(task.goalId) : undefined
    const projection = projectUpcomingTriggerFires({
      task,
      goal,
      now,
      days: PULL_UP_WINDOW_DAYS,
    })
    if (!projection) continue

    const { byGoalTrigger } = projection
    const ruleSummary = summarizeTriggerRule(projection.rule, t)
    let windowLabel: string | undefined
    if (!byGoalTrigger && task.trigger?.startsAt && task.trigger.endsAt) {
      windowLabel = `${format(task.trigger.startsAt, "MMM d")} – ${format(
        task.trigger.endsAt,
        "MMM d"
      )}`
    }

    const pullUps = projection.fires
      .filter((key) => key !== todayKey)
      .map((key) => ({ key, label: toLabel(key) }))

    if (pullUps.length === 0) continue

    items.push({
      taskId: task.id,
      title: task.title,
      goalId: task.goalId ?? undefined,
      goalTitle: goal?.title ?? "",
      byGoalTrigger,
      ruleSummary,
      windowLabel,
      pullUps,
    })
  }

  return items.sort((left, right) =>
    left.pullUps[0].key.localeCompare(right.pullUps[0].key)
  )
}
