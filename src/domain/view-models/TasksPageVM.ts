import type { TaskID, TaskRuntimeID } from "@/domain/value-objects/types"
import type {
  TaskRuntimeStatus,
  TaskRuntimeSource,
} from "@/domain/entities/TaskRuntimeEntity"
import type { TimeQuotaVM } from "@/domain/view-models/HomePageVM"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

export interface TasksTaskItemVM {
  runtimeId: TaskRuntimeID
  taskId: TaskID
  title: string
  goalId?: string
  goalTitle?: string
  bucket: "todo" | "inProgress" | "done"
  runtimeStatus: TaskRuntimeStatus | null
  runtimeSource?: TaskRuntimeSource
  steps: { id: string; title: string; done: boolean }[]
  dueAt?: string
  dueAtRaw?: Date
  estimatedDuration?: number
  isForced?: boolean
  /**
   * The due date that forced this run into today — the task's own for
   * `duePolicy`, the goal's for `goalDuePolicy`. Its presence is what makes the
   * run non-dismissible (removing it would fight the due policy).
   */
  forcedDueAt?: Date
  /** Whether this task is managed by repeat policy. */
  isRepeatTask?: boolean
  /** ISO date key (yyyy-MM-dd) for repeat planned occurrence. */
  plannedForDate?: LocalDateKey
  /** Localized display label for repeat plan date. */
  plannedForLabel?: string
  /** Localized repeat cadence summary (repeat tasks only). */
  repeatRuleSummary?: string
  isDebtItem?: boolean
  /** A done counter task that still has occurrences left can be run again today. */
  canRunAgain?: boolean
  /** Localized run marker: an ordinal on open items, a count on collapsed done rows. */
  runsLabel?: string
  /** The items behind a collapsed done row; set only when they are not interchangeable (needs the runs dialog). */
  collapsedRunIds?: TaskRuntimeID[]
  /** Localized "since <day>" for an in-progress item carried over from an earlier day. */
  carriedOverLabel?: string
  /**
   * The user removed this task from TODAY's plan. Day-scoped — it clears at the
   * day boundary (or when the task is re-added by hand), so it reads as
   * "excluded from today", not a permanent state.
   */
  isDismissedToday?: boolean
}

export interface TasksTodayBucketsVM {
  todo: TasksTaskItemVM[]
  inProgress: TasksTaskItemVM[]
  done: TasksTaskItemVM[]
}

export interface TasksPlanBucketsVM {
  tomorrow: TasksTaskItemVM[]
  in7Days: TasksTaskItemVM[]
}

export interface TasksPageVM {
  today: TasksTodayBucketsVM
  timeQuota: TimeQuotaVM
  plans: TasksPlanBucketsVM
  unselected: TasksTaskItemVM[]
}
