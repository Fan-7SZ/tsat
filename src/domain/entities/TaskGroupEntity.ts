import type {
  TaskID,
  GoalID,
  Steps,
  DurationInMinutes,
} from "../value-objects/types"
import type { ActiveRepeatRule } from "../value-objects/repeatRule"
import type { triggerRule } from "../value-objects/triggerRule"

/** Repeat configuration: the cadence rule plus its optional explicit window. */
interface TaskRepeatConfig {
  rule: ActiveRepeatRule
  startsAt?: Date
  endsAt?: Date
}

/**
 * Trigger configuration (reactive scheduling). Mutable trigger state
 * (lastTriggeredDateKey) lives in the taskTriggerStates table.
 * @property startsAt - Window start; also the anchor for interval math.
 * Defaults to the task's createdAt when absent.
 * @property endsAt - Window end; the trigger never fires after this day.
 * Absent means the trigger runs indefinitely. Either both or neither of
 * startsAt/endsAt must be set.
 */
interface TaskTriggerConfig {
  rule: triggerRule
  startsAt?: Date
  endsAt?: Date
}

/**
 * @property id - Unique identifier for the task group.
 * @property goalId - Optional identifier linking the task group to a specific goal.
 * @property title - The title of the task group.
 * @property description - Optional detailed description of the task group.
 * @property createdAt - Timestamp indicating when the task group was created.
 * @property dueAt - Optional timestamp indicating when the task group is due.
 * @property steps - Optional number of steps or sub-tasks within the task group.
 * @property estimatedDuration - Optional estimated duration in minutes for completing the task group.
 * @property repeat - Optional repeat configuration; mutually exclusive with trigger.
 * @property trigger - Optional trigger configuration; mutually exclusive with repeat.
 * @property allowCrossDay - When true, an in-progress runtime of this task is
 * preserved across the day boundary instead of being swept; also (for trigger
 * tasks) skips re-firing while an unfinished runtime exists. Available to all
 * task kinds except repeat-rule tasks.
 * @property total - Total count of occurrences for this task group (for tracking progress).
 * @property completedCount - Count of completed occurrences for this task group (for tracking progress).
 * @property notes - Optional additional notes about the task group.
 */
interface TaskGroupEntity {
  id: TaskID
  goalId?: GoalID
  title: string
  description?: string
  createdAt: Date
  dueAt?: Date
  steps?: Steps
  estimatedDuration?: DurationInMinutes
  repeat?: TaskRepeatConfig
  trigger?: TaskTriggerConfig
  allowCrossDay?: boolean
  total: number
  completedCount: number
  notes?: string
}

export type { TaskGroupEntity, TaskRepeatConfig, TaskTriggerConfig }
