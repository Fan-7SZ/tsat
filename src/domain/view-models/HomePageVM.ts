import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type {
  ActivityID,
  GoalID,
  TaskID,
  TaskRuntimeID,
} from "@/domain/value-objects/types"
import type {
  TaskRuntimeSource,
  TaskRuntimeStatus,
} from "@/domain/entities/TaskRuntimeEntity"
import type { ActivityKind } from "@/domain/entities/ActivityEntity"
import type { GoalFocusStatus } from "@/domain/derived/GoalFocus"
import type { LocalDateKey } from "@/domain/value-objects/schemas"
import type { DayPressure } from "@/utils/planning-pressure"

export interface HomeTaskItemVM {
  runtimeId: TaskRuntimeID
  taskId: TaskID
  title: string
  goalId?: GoalID
  goalTitle?: string
  bucket: "todo" | "inProgress" | "done"
  runtimeStatus: TaskRuntimeStatus
  runtimeSource?: TaskRuntimeSource
  steps: { id: string; title: string; done: boolean }[]
  dueAt?: string
  dueAtRaw?: Date
  estimatedDuration?: number
  isForced?: boolean
  /**
   * The due date that forced this run into today — the task's own for
   * `duePolicy`, the goal's for `goalDuePolicy`. Its presence is what makes the
   * run non-dismissible.
   */
  forcedDueAt?: Date
  isRepeatTask?: boolean
  plannedForDate?: LocalDateKey
  plannedForLabel?: string
  isDebtItem?: boolean
  /** A counter task with occurrences left can be given another run today. */
  canRunAgain?: boolean
  /**
   * Localized run marker, set only when the task holds several runs today —
   * otherwise the rows would be indistinguishable. In todo / inProgress each run
   * is its own row and this ordinals it ("run 2"); in done the runs collapse to
   * one row and this counts them ("done 2x").
   */
  runsLabel?: string
  /**
   * The runs behind a collapsed done row. Set only when those runs are NOT
   * interchangeable — it is the "this row needs the runs dialog" signal, since
   * the row no longer maps to a single runtime and picking one silently would
   * be wrong.
   */
  collapsedRunIds?: TaskRuntimeID[]
  /**
   * Localized "since <day>", set on an in-progress run that was started on an
   * earlier day and carried across the boundary (only `allowCrossDay` tasks can
   * do this). Without it, a carried-over item is indistinguishable from one
   * started today.
   */
  carriedOverLabel?: string
}

export interface HomeTaskBucketsVM {
  todo: HomeTaskItemVM[]
  inProgress: HomeTaskItemVM[]
  done: HomeTaskItemVM[]
}

export interface TodayFocusItemVM {
  goal: GoalEntity
  progressPercent: number
  isAdded: boolean
  dueLabel?: string
  isForced?: boolean
  focusStatuses?: GoalFocusStatus[]
  /**
   * Every unfinished task of this goal is removed from today, so focusing it
   * cannot surface anything — the toggle is disabled rather than flipping with
   * no effect. Day-scoped, like the dismissals themselves.
   */
  allTasksDismissed?: boolean
}

export interface ActivityLogItemVM {
  id: ActivityID
  kind: ActivityKind
  taskId: TaskID
  taskTitle: string
  recordedAtLabel: string
}

export interface FocusQuotaVM {
  focusedCount: number
  forcedFocusedCount: number
  maxFocusGoals: number
}

export interface TimeQuotaVM {
  usedMinutes: number
  dailyCapacityMinutes: number
}

export interface HomePageVM {
  greetingTitle: string
  dateLabel: string
  todayTasks: HomeTaskBucketsVM
  timeQuota: TimeQuotaVM
  todayFocus: TodayFocusItemVM[]
  focusQuota: FocusQuotaVM
  pressureByDay: Record<LocalDateKey, DayPressure>
}
