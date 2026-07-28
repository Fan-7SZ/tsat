import type { GoalID, TaskID } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

/**
 * Durable, per-record user-intent state that must merge across devices (unlike
 * the derived runtime blob, which is whole-blob LWW). Stored in their own Dexie
 * tables and merged via the record-level LWW + tombstone engine, then consumed
 * by the planner to derive today's focus/plan.
 *
 * Both are day-scoped: a row applies only to its `dateKey` (today). The
 * cross-day sweep tombstones stale rows so the reset propagates across devices.
 */

/**
 * "This goal is focused for `dateKey`." Keyed by goalId.
 *
 * `source` says who put it there — the user, or a goal trigger firing at the
 * day boundary. Both behave identically (day-scoped, un-focusable); it only
 * changes how the focus reason is worded in the UI. Absent on rows written
 * before the field existed, which read as `"manual"`.
 */
export interface ManualFocusRecord {
  goalId: GoalID
  dateKey: LocalDateKey
  source?: ManualFocusSource
}

export type ManualFocusSource = "manual" | "trigger"

/** "The user removed this task from `dateKey`'s auto-plan." Keyed by taskId. */
export interface DismissedTaskRecord {
  taskId: TaskID
  dateKey: LocalDateKey
}
