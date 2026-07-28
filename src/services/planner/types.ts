import type { EntitySnapshot } from "@/persistence/repository"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type {  TaskRuntimeID } from "@/domain/value-objects/types"

/**
 * PlannerPolicy defines the user's preferences for how the planner should schedule tasks and focus goals.
 * where the setting entrance is at home page's setting dialog.
 */
export interface PlannerPolicy {
  /** Total schedulable minutes available for one day. */
  dailyCapacityMinutes: number
  /** Tasks whose due date is within this many days will be forced into today.
   *  0 = due today only, 1 = due today or tomorrow, etc. */
  taskForcedTodoDays: number
  /** Goals whose due date is within this many days will be forced into focused.
   *  Same semantics as taskForcedTodoDays. */
  goalForcedFocusDays: number
  /** Maximum number of focused goals allowed per day.
   *  Forced-focused goals count toward this limit. */
  maxFocusGoals: number
}

/**
 * All data the slice passes to the planner service for one replan cycle.
 * The repeat ledger is the source of truth for repeat task state and is read
 * directly from the entity snapshot — the planner does not rebuild it.
 */
export interface PlannerInput {
  snapshot: EntitySnapshot
  currentTaskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
  policy: PlannerPolicy
  now: Date
}

/**
 * What the planner service returns — today's run map, diff-applied to the
 * dayRuns table by the slice. Goal focus is derived at read time
 * (deriveGoalFocus) and is not part of the output.
 */
export interface PlannerOutput {
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
}
