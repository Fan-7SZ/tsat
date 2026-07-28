import type { triggerRule } from "../value-objects/triggerRule"
import type { GoalID, TagID } from "../value-objects/types"

/**
 * Trigger configuration (reactive scheduling). Mutable trigger state
 * (lastTriggeredDateKey) lives in the goalTriggerStates table.
 */
interface GoalTriggerConfig {
  rule: triggerRule
  /**
   * Whether each reset stamps a due date on the goal: 23:59 of the day before
   * the next fire (so a daily trigger is due the same evening). Absent means
   * true — the behavior before this became configurable.
   */
  setDueOnReset?: boolean
}

interface GoalEntity {
  id: GoalID
  tagId?: TagID
  title: string
  notes?: string
  description?: string
  createdAt: Date
  /**
   * Optional due date. Purely a soft signal for the due-focus policy (pull the
   * goal / its frontier tasks into "today" as the date approaches). Goals have
   * no start date — scheduling windows live entirely on repeat/trigger configs.
   */
  dueAt?: Date
  trigger?: GoalTriggerConfig
}

export type { GoalEntity, GoalTriggerConfig }
