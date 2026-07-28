import type { TaskID } from "../value-objects/types"
import type { LocalDateKey } from "../value-objects/schemas"

/**
 * Mutable trigger state for a task. The trigger configuration itself lives on
 * TaskGroupEntity.trigger; this record only tracks when it last fired. A
 * record is created lazily on the first fire.
 */
export type TaskTriggerState = {
  taskId: TaskID
  lastTriggeredDateKey?: LocalDateKey
}
