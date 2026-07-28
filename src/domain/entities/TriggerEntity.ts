import type { GoalID } from "../value-objects/types"
import type { LocalDateKey } from "../value-objects/schemas"

/**
 * Mutable trigger state for a goal. The trigger configuration itself lives on
 * GoalEntity.trigger; this record only tracks when it last fired. A record is
 * created lazily on the first fire.
 */
export type GoalTriggerState = {
  goalId: GoalID
  lastTriggeredDateKey?: LocalDateKey
}
