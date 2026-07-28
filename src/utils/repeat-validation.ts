import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type {
  TaskGroupEntity,
  TaskRepeatConfig,
} from "@/domain/entities/TaskGroupEntity"
import type { ID, TaskID } from "@/domain/value-objects/types"
import type { Dictionary } from "@/i18n/types"
import {
  collectAncestorNodes,
  collectDescendantNodes,
} from "@/utils/dependency-tree"
import { computeProjectedConductedCount } from "@/utils/repeat-count"
import {
  getRepeatRangeCompleteness,
  resolveRepeatWindow,
  toClosedDayRange,
  type ClosedDayRange,
} from "@/utils/repeat-window"

// No chain-order or goal-window errors exist here: dependency ordering is
// enforced structurally by the planner, and a goal's due date does not bound
// a repeat/trigger window. Only self-contained config errors are reported.
export type RepeatValidationErrorKind =
  | "partial-range"
  | "invalid-range"
  | "no-occurrences"
  | "total-exceeds-occurrences"

export interface RepeatValidationError {
  kind: RepeatValidationErrorKind
  /**
   * English fallback message. UI callers should localize via
   * `translateScheduleValidationError`; non-React callers (commands) use this
   * as-is until they gain access to a dictionary.
   */
  message: string
  /** Which schedule window produced the error, used for localization. */
  periodKind?: "repeat" | "trigger"
  maximumAllowedTotal?: number
}

export interface AncestorRepeatRange {
  taskId: TaskID
  title: string
  range: ClosedDayRange
}

export interface RepeatValidationResult {
  error: RepeatValidationError | null
  effectiveRange: ClosedDayRange | null
  /**
   * Schedule windows of neighbouring tasks on the dependency chain. These are
   * surfaced to the calendar purely as a soft, non-blocking colour hint — they
   * produce no errors and never gate saving. Ancestors and descendants
   * are kept separate but rendered in the same colour.
   */
  ancestorRanges: AncestorRepeatRange[]
  descendantRanges: AncestorRepeatRange[]
}

export interface ValidateRepeatConfigurationInput {
  repeat?: TaskRepeatConfig
  goal?: Pick<GoalEntity, "dueAt">
  fallbackStart: Date
  dependency?: DependencyEntity | null
  currentNodeData?: ID
  tasksById?: Record<string, TaskGroupEntity | undefined>
  /** When set, the desired completion count is capped at the number of
   * planned occurrences in the resolved repeat window. */
  total?: number
}

export interface ValidateTriggerWindowConfigurationInput {
  window?: { startsAt?: Date; endsAt?: Date }
  goal?: Pick<GoalEntity, "dueAt">
  fallbackStart: Date
  dependency?: DependencyEntity | null
  currentNodeData?: ID
  tasksById?: Record<string, TaskGroupEntity | undefined>
}

/**
 * The schedule window a task occupies in its dependency chain: the repeat
 * window (from the repeat config's own start/end) for repeat tasks, or the
 * explicit trigger window for trigger tasks. Windowless tasks return null and
 * simply contribute no colour hint.
 */
export function getTaskScheduleWindow(
  task: TaskGroupEntity
): ClosedDayRange | null {
  if (task.repeat != null) {
    return resolveRepeatWindow(
      task.createdAt,
      task.repeat.startsAt,
      task.repeat.endsAt
    )
  }

  if (task.trigger != null) {
    return toClosedDayRange(task.trigger.startsAt, task.trigger.endsAt)
  }

  return null
}

interface ChainContext {
  dependency?: DependencyEntity | null
  currentNodeData?: ID
  tasksById?: Record<string, TaskGroupEntity | undefined>
}

function collectChainRanges(
  context: ChainContext,
  direction: "ancestor" | "descendant"
): AncestorRepeatRange[] {
  const ranges: AncestorRepeatRange[] = []

  if (!context.dependency || !context.currentNodeData || !context.tasksById) {
    return ranges
  }

  const collect =
    direction === "ancestor" ? collectAncestorNodes : collectDescendantNodes

  for (const entry of collect(context.dependency, context.currentNodeData)) {
    const task = context.tasksById[entry.node.data]
    if (!task) {
      continue
    }

    const range = getTaskScheduleWindow(task)
    if (!range) {
      continue
    }

    ranges.push({ taskId: task.id, title: task.title, range })
  }

  return ranges
}

/**
 * Collect the schedule windows of neighbouring tasks on the dependency chain so
 * the calendar can render them as a soft colour hint.
 *
 * Chain order is not enforced here. Task ordering ("a successor cannot
 * run before its predecessor finishes") is guaranteed structurally by the
 * dependency graph plus completion state in the planner, so overlapping time
 * windows are purely informational and must never block saving.
 */
function collectChainHint(context: ChainContext): {
  ancestorRanges: AncestorRepeatRange[]
  descendantRanges: AncestorRepeatRange[]
} {
  const byStart = (left: AncestorRepeatRange, right: AncestorRepeatRange) =>
    left.range.start.getTime() - right.range.start.getTime()

  const ancestorRanges = collectChainRanges(context, "ancestor").sort(byStart)
  const descendantRanges = collectChainRanges(context, "descendant").sort(
    byStart
  )

  return { ancestorRanges, descendantRanges }
}

export function validateRepeatConfiguration(
  input: ValidateRepeatConfigurationInput
): RepeatValidationResult {
  const chain = collectChainHint(input)

  if (input.repeat == null) {
    return { error: null, effectiveRange: null, ...chain }
  }

  const rangeCompleteness = getRepeatRangeCompleteness(
    input.repeat.startsAt,
    input.repeat.endsAt
  )

  if (rangeCompleteness === "partial") {
    return {
      error: {
        kind: "partial-range",
        periodKind: "repeat",
        message: "Pick both start and end dates for the repeat period.",
      },
      effectiveRange: null,
      ...chain,
    }
  }

  const effectiveRange = resolveRepeatWindow(
    input.fallbackStart,
    input.repeat.startsAt,
    input.repeat.endsAt
  )

  if (!effectiveRange) {
    return { error: null, effectiveRange: null, ...chain }
  }

  if (effectiveRange.end.getTime() < effectiveRange.start.getTime()) {
    return {
      error: {
        kind: "invalid-range",
        periodKind: "repeat",
        message: "Repeat period end must be on or after the start date.",
      },
      effectiveRange,
      ...chain,
    }
  }

  const occurrences = computeProjectedConductedCount(
    effectiveRange.start,
    effectiveRange.end,
    input.repeat.rule
  )

  // A bounded window with zero occurrences can never be completed — the
  // planner would silently never schedule the task.
  if (occurrences === 0) {
    return {
      error: {
        kind: "no-occurrences",
        periodKind: "repeat",
        message:
          "No occurrences fall inside the repeat window. Adjust the dates or pick at least one weekday.",
      },
      effectiveRange,
      ...chain,
    }
  }

  if (input.total != null && input.total > occurrences) {
    return {
      error: {
        kind: "total-exceeds-occurrences",
        periodKind: "repeat",
        message: `Completion count cannot exceed the ${occurrences} planned occurrences in the repeat window.`,
        maximumAllowedTotal: occurrences,
      },
      effectiveRange,
      ...chain,
    }
  }

  return { error: null, effectiveRange, ...chain }
}

/**
 * Validate a trigger window. A windowless trigger (neither date set) is always
 * valid — it just runs indefinitely. The dependency chain only contributes a
 * soft colour hint; it never blocks saving.
 */
export function validateTriggerWindowConfiguration(
  input: ValidateTriggerWindowConfigurationInput
): RepeatValidationResult {
  const chain = collectChainHint(input)

  const startsAt = input.window?.startsAt
  const endsAt = input.window?.endsAt
  const rangeCompleteness = getRepeatRangeCompleteness(startsAt, endsAt)

  if (rangeCompleteness === "empty") {
    return { error: null, effectiveRange: null, ...chain }
  }

  if (rangeCompleteness === "partial") {
    return {
      error: {
        kind: "partial-range",
        periodKind: "trigger",
        message: "Pick both start and end dates for the trigger period.",
      },
      effectiveRange: null,
      ...chain,
    }
  }

  const effectiveRange = toClosedDayRange(startsAt, endsAt)!

  if (effectiveRange.end.getTime() < effectiveRange.start.getTime()) {
    return {
      error: {
        kind: "invalid-range",
        periodKind: "trigger",
        message: "Trigger period end must be on or after the start date.",
      },
      effectiveRange,
      ...chain,
    }
  }

  return { error: null, effectiveRange, ...chain }
}

/**
 * Validate every scheduled task (repeat or trigger-windowed) in a dependency
 * tree to ensure no task's schedule window overlaps with an ancestor's or
 * descendant's.
 */
export function validateTreeRepeatIntegrity(
  dep: DependencyEntity,
  tasksById: Record<string, TaskGroupEntity | undefined>,
  goal?: Pick<GoalEntity, "dueAt">
): { valid: boolean; errorMessage?: string } {
  for (const node of dep.tree) {
    const task = tasksById[node.data]
    if (!task) continue

    if (task.repeat != null) {
      const result = validateRepeatConfiguration({
        repeat: task.repeat,
        goal,
        fallbackStart: task.createdAt,
        dependency: dep,
        currentNodeData: node.data,
        tasksById,
      })

      if (result.error) {
        return { valid: false, errorMessage: result.error.message }
      }
      continue
    }

    if (task.trigger != null) {
      const result = validateTriggerWindowConfiguration({
        window: task.trigger,
        goal,
        fallbackStart: task.createdAt,
        dependency: dep,
        currentNodeData: node.data,
        tasksById,
      })

      if (result.error) {
        return { valid: false, errorMessage: result.error.message }
      }
    }
  }

  return { valid: true }
}

/**
 * Localize a `RepeatValidationError` for display. Callers with access to the
 * i18n dictionary should use this instead of the raw English `error.message`.
 */
export function translateScheduleValidationError(
  error: RepeatValidationError,
  t: Dictionary
): string {
  const sv = t.scheduleValidation
  const period =
    error.periodKind === "trigger" ? sv.triggerPeriod : sv.repeatPeriod

  switch (error.kind) {
    case "partial-range":
      return sv.pickBothDates(period)
    case "invalid-range":
      return sv.endOnOrAfterStart(period)
    case "no-occurrences":
      return sv.noOccurrences
    case "total-exceeds-occurrences":
      return sv.totalExceedsOccurrences(error.maximumAllowedTotal ?? 0)
  }
}
