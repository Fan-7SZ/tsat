import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import type { ManualFocusSource } from "@/domain/entities/IntentRecord"

export type GoalFocusStatus =
  | {
      /**
       * A day-scoped focus row exists for this goal. `source` only affects the
       * wording of the reason — a trigger-placed focus is just as un-focusable
       * as one the user placed by hand.
       */
      kind: "manualFocus"
      isBlocking: false
      source?: ManualFocusSource
    }
  | { kind: "autoPlannedTask"; isBlocking: false; runtimeKeys: string[] }
  | { kind: "goalDuePolicy"; isBlocking: true; dueAt: Date }
  | {
      kind: "taskDuePolicy"
      isBlocking: true
      taskId: TaskID
      taskTitle: string
      dueAt: Date
    }
  | {
      kind: "manualTodayTask"
      isBlocking: true
      taskId: TaskID
      taskTitle: string
    }
  | {
      kind: "repeatPolicyPoint"
      isBlocking: true
      taskId: TaskID
      taskTitle: string
      plannedForDate: LocalDateKey
    }
  | {
      kind: "taskTriggerPolicy"
      isBlocking: true
      taskId: TaskID
      taskTitle: string
      firedDate: LocalDateKey
    }

export type GoalBlockingFocusStatus = Extract<
  GoalFocusStatus,
  { isBlocking: true }
>

export interface GoalFocus {
  id: GoalID
  isFocused: boolean
  focusStatuses: GoalFocusStatus[]
}
