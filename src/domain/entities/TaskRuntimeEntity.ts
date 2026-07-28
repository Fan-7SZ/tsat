import type { TaskID, TaskRuntimeID, Step } from "@/domain/value-objects/types"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
export type TaskRuntimeStatus = "todo" | "inProgress" | "done"
export type TaskRuntimeSource =
  | "manual"
  | "duePolicy"
  | "goalDuePolicy"
  | "repeatPolicy"
  | "triggerPolicy"
  | "default"
export type StepID = Step["id"]
type TaskRuntimeBase = {
  id: TaskRuntimeID
  taskId: TaskID
  arrangementStatus: TaskRuntimeStatus
  /**
   * Per-runtime step progress, keyed by the persisted step's stable id (not
   * index). The step definitions live on the task; this only records which of
   * them are checked off for this runtime. Keying by id makes progress immune
   * to step reorder/title edits; ids missing from the task's current steps are
   * harmless orphans (filtered out at read time).
   */
  stepsCompleted?: StepID[]
}

export type TaskRuntimeEntity = TaskRuntimeBase &
  (
    | {
        source: "manual" | "default" | "duePolicy" | "goalDuePolicy" | "triggerPolicy"
      }
    | {
        source: "repeatPolicy"
        /** The dateKey of the repeat occurrence this runtime serves. */
        plannedForDate: LocalDateKey
      }
  )

export type RepeatPolicyTaskRuntime = Extract<
  TaskRuntimeEntity,
  { source: "repeatPolicy" }
>

/**
 * A run persisted as a Dexie `dayRuns` row. `dateKey` is the day the run sits
 * on today's list — the day-scoped GC key. A debt run serving a past repeat
 * point still carries the day it was materialized (its `plannedForDate` keeps
 * pointing at the owed occurrence); an allow-cross-day carryover gets its
 * dateKey rewritten at the day sweep.
 */
export type DayRunEntity = TaskRuntimeEntity & { dateKey: LocalDateKey }
