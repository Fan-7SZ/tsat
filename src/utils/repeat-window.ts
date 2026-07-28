import { format, startOfDay } from "date-fns"

/** Sources of information for determining the repeat window of a task or goal.
@property dueAt - The due date of the goal or task (upper bound only; goals no
longer carry a start date).
*/
interface GoalWindowSource {
  dueAt?: Date
}

export interface ClosedDayRange {
  start: Date
  end: Date
}

export type RepeatRangeCompleteness = "empty" | "partial" | "complete"

function normalizeDay(date: Date): Date {
  return startOfDay(date)
}

export function formatDay(date: Date): string {
  return format(normalizeDay(date), "yyyy-MM-dd")
}

export function toClosedDayRange(
  start?: Date,
  end?: Date
): ClosedDayRange | null {
  if (!start || !end) {
    return null
  }

  return {
    start: normalizeDay(start),
    end: normalizeDay(end),
  }
}

export function getRepeatRangeCompleteness(
  start?: Date,
  end?: Date
): RepeatRangeCompleteness {
  if (!start && !end) {
    return "empty"
  }

  if (start && end) {
    return "complete"
  }

  return "partial"
}

export function isDateOutsideGoalRange(
  date: Date,
  goal: GoalWindowSource | undefined
): boolean {
  if (!goal) {
    return false
  }

  const day = normalizeDay(date).getTime()
  const endsAt = goal.dueAt ? normalizeDay(goal.dueAt).getTime() : undefined

  // A goal's due date is only an upper bound: you cannot schedule occurrences
  // after the goal is due. There is no lower bound anymore (goals have no start).
  if (endsAt != null && day > endsAt) {
    return true
  }

  return false
}

/**
 * Resolves the repeat window from the repeat config's OWN start/end. Repeat is
 * decoupled from the goal period: the goal contributes neither a start nor an
 * end fallback. A repeat must carry its own end (the ledger enumerator needs a
 * finite upper bound), otherwise the window is unresolvable.
 * @param fallbackStart - Anchor used when the repeat has no explicit start (task.createdAt).
 * @param repeatStartsAt - The explicit start date of the repeat period.
 * @param repeatEndsAt - The explicit end date of the repeat period.
 * @returns The closed day range, or null when there is no end to enumerate to.
 */
export function resolveRepeatWindow(
  fallbackStart: Date,
  repeatStartsAt?: Date,
  repeatEndsAt?: Date
): ClosedDayRange | null {
  if (!repeatEndsAt) {
    return null
  }

  return {
    start: startOfDay(repeatStartsAt ?? fallbackStart),
    end: startOfDay(repeatEndsAt),
  }
}

export function isClosedDayRangeWithin(
  target: ClosedDayRange,
  container: ClosedDayRange
): boolean {
  return (
    target.start.getTime() >= container.start.getTime() &&
    target.end.getTime() <= container.end.getTime()
  )
}
