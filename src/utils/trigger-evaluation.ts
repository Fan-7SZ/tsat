import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type { TaskGroupEntity } from "@/domain/entities/TaskGroupEntity"
import type { TaskRuntimeEntity } from "@/domain/entities/TaskRuntimeEntity"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import type { TaskRuntimeID } from "@/domain/value-objects/types"
import { parseDateKey, toLocalDateKey } from "@/utils/date"
import { getTaskRuntimeEntries } from "@/utils/task-runtime"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

function startOfLocalDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function differenceInLocalDays(left: Date, right: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor(
    (startOfLocalDay(left).getTime() - startOfLocalDay(right).getTime()) /
      msPerDay
  )
}

function startOfLocalWeek(date: Date): Date {
  const result = startOfLocalDay(date)
  result.setDate(result.getDate() - result.getDay())
  return result
}

function differenceInLocalWeeks(left: Date, right: Date): number {
  return Math.floor(
    differenceInLocalDays(startOfLocalWeek(left), startOfLocalWeek(right)) / 7
  )
}

// Months shorter than dayOfMonth fire on their last day instead of skipping.
function monthlyFiresOnDay(day: Date, dayOfMonth: number): boolean {
  const lastDayOfMonth = new Date(
    day.getFullYear(),
    day.getMonth() + 1,
    0
  ).getDate()
  return day.getDate() === Math.min(dayOfMonth, lastDayOfMonth)
}

function evaluatePendingRuleDateKey(options: {
  rule: triggerRule
  anchor: Date
  lastTriggeredDateKey?: LocalDateKey
  now: Date
}): LocalDateKey | null {
  const { rule, anchor, lastTriggeredDateKey, now } = options
  const todayKey = toLocalDateKey(now)

  if (rule.mode === "daily") {
    const daysSinceAnchor = differenceInLocalDays(now, anchor)
    const interval = Math.max(1, rule.interval)
    return daysSinceAnchor >= 0 && daysSinceAnchor % interval === 0
      ? todayKey
      : null
  }

  if (rule.mode === "weekly") {
    const weeksSinceAnchor = differenceInLocalWeeks(now, anchor)
    const interval = Math.max(1, rule.interval)
    const shouldRunThisWeek =
      weeksSinceAnchor >= 0 && weeksSinceAnchor % interval === 0
    return shouldRunThisWeek && rule.daysOfWeek.includes(now.getDay())
      ? todayKey
      : null
  }

  if (rule.mode === "monthly") {
    const daysSinceAnchor = differenceInLocalDays(now, anchor)
    return daysSinceAnchor >= 0 && monthlyFiresOnDay(now, rule.dayOfMonth)
      ? todayKey
      : null
  }

  const pendingCustomDate = rule.date
    .map(toLocalDateKey)
    .filter(
      (dateKey) =>
        dateKey <= todayKey &&
        (!lastTriggeredDateKey || dateKey > lastTriggeredDateKey)
    )
    .sort()
    .at(-1)

  return pendingCustomDate ?? null
}

export function getPendingTriggerDateKey(options: {
  goal: Pick<GoalEntity, "createdAt" | "trigger">
  lastTriggeredDateKey?: LocalDateKey
  now: Date
}): LocalDateKey | null {
  const { goal, lastTriggeredDateKey, now } = options
  // Check enabling condition
  if (goal.trigger == null) return null

  // Check if already triggered today
  const todayKey = toLocalDateKey(now)
  if (lastTriggeredDateKey === todayKey) return null

  return evaluatePendingRuleDateKey({
    rule: goal.trigger.rule,
    anchor: goal.createdAt,
    lastTriggeredDateKey,
    now,
  })
}

export function getPendingTaskTriggerDateKey(options: {
  task: Pick<TaskGroupEntity, "id" | "createdAt" | "trigger" | "allowCrossDay">
  lastTriggeredDateKey?: LocalDateKey
  taskRuntime: Record<TaskRuntimeID, TaskRuntimeEntity>
  now: Date
}): LocalDateKey | null {
  const { task, lastTriggeredDateKey, taskRuntime, now } = options
  // Check enabling condition
  if (task.trigger == null) return null

  // Check if already triggered today
  const todayKey = toLocalDateKey(now)
  if (lastTriggeredDateKey === todayKey) return null

  // Check the trigger window: never fire before startsAt or after endsAt.
  if (
    task.trigger.startsAt != null &&
    todayKey < toLocalDateKey(task.trigger.startsAt)
  ) {
    return null
  }
  if (
    task.trigger.endsAt != null &&
    todayKey > toLocalDateKey(task.trigger.endsAt)
  ) {
    return null
  }

  const pendingDateKey = evaluatePendingRuleDateKey({
    rule: task.trigger.rule,
    anchor: task.trigger.startsAt ?? task.createdAt,
    lastTriggeredDateKey,
    now,
  })
  if (!pendingDateKey) return null

  // allowCrossDay: skip the trigger while the task still has an unfinished
  // runtime; without it, the trigger fires regardless of task state.
  if (task.allowCrossDay) {
    const hasUnfinishedRuntime = getTaskRuntimeEntries(
      taskRuntime,
      task.id
    ).some((runtime) => runtime.arrangementStatus !== "done")
    if (hasUnfinishedRuntime) return null
  }

  return pendingDateKey
}

/** Whether `rule` fires on the calendar day `day`, anchored at `anchor`. */
function ruleFiresOnDate(
  rule: triggerRule,
  anchor: Date,
  day: Date
): boolean {
  if (rule.mode === "daily") {
    const daysSinceAnchor = differenceInLocalDays(day, anchor)
    const interval = Math.max(1, rule.interval)
    return daysSinceAnchor >= 0 && daysSinceAnchor % interval === 0
  }

  if (rule.mode === "weekly") {
    const weeksSinceAnchor = differenceInLocalWeeks(day, anchor)
    const interval = Math.max(1, rule.interval)
    return (
      weeksSinceAnchor >= 0 &&
      weeksSinceAnchor % interval === 0 &&
      rule.daysOfWeek.includes(day.getDay())
    )
  }

  if (rule.mode === "monthly") {
    const daysSinceAnchor = differenceInLocalDays(day, anchor)
    return daysSinceAnchor >= 0 && monthlyFiresOnDay(day, rule.dayOfMonth)
  }

  const dayKey = toLocalDateKey(day)
  return rule.date.some((date) => toLocalDateKey(date) === dayKey)
}

/** Local midnight of `dayOfMonth` in the given month, clamped to its length. */
function clampedDayOfMonth(
  year: number,
  monthIndex: number,
  dayOfMonth: number
): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(dayOfMonth, lastDay))
}

/**
 * First calendar day strictly after `afterDateKey` on which `rule` fires,
 * anchored at `anchor`. Computed directly from each rule's shape (no day
 * scanning). Null only when the rule can never fire again: an exhausted custom
 * date list, or a weekly rule with no weekdays selected.
 */
export function getNextTriggerDateKeyAfter(options: {
  rule: triggerRule
  anchor: Date
  afterDateKey: LocalDateKey
}): LocalDateKey | null {
  const { rule, anchor, afterDateKey } = options
  const afterDate = parseDateKey(afterDateKey)

  if (rule.mode === "daily") {
    // Fire days are anchor + k·interval; jump to the first multiple past
    // `after` (or to the anchor itself when `after` precedes it).
    const interval = Math.max(1, rule.interval)
    const daysSinceAnchor = differenceInLocalDays(afterDate, anchor)
    const k =
      daysSinceAnchor < 0 ? 0 : Math.floor(daysSinceAnchor / interval) + 1
    const next = startOfLocalDay(anchor)
    next.setDate(next.getDate() + k * interval)
    return toLocalDateKey(next)
  }

  if (rule.mode === "weekly") {
    if (rule.daysOfWeek.length === 0) return null
    const interval = Math.max(1, rule.interval)
    const days = [...rule.daysOfWeek].sort((a, b) => a - b)
    const weeksSinceAnchor = differenceInLocalWeeks(afterDate, anchor)

    // Later selected weekday within `after`'s own week, if it's a fire week.
    if (weeksSinceAnchor >= 0 && weeksSinceAnchor % interval === 0) {
      const nextDay = days.find((day) => day > afterDate.getDay())
      if (nextDay != null) {
        const next = new Date(afterDate)
        next.setDate(next.getDate() + (nextDay - afterDate.getDay()))
        return toLocalDateKey(next)
      }
    }

    // Otherwise the earliest selected weekday of the next fire week.
    const nextWeek =
      weeksSinceAnchor < 0
        ? 0
        : (Math.floor(weeksSinceAnchor / interval) + 1) * interval
    const next = startOfLocalWeek(anchor)
    next.setDate(next.getDate() + nextWeek * 7 + days[0])
    return toLocalDateKey(next)
  }

  if (rule.mode === "monthly") {
    // The clamped day in `after`'s month, or the following month's if already
    // passed; bumped forward once more if that still precedes the anchor.
    const nextOnOrAfter = (start: Date): Date => {
      const candidate = clampedDayOfMonth(
        start.getFullYear(),
        start.getMonth(),
        rule.dayOfMonth
      )
      return candidate >= start
        ? candidate
        : clampedDayOfMonth(
            start.getFullYear(),
            start.getMonth() + 1,
            rule.dayOfMonth
          )
    }
    const dayAfter = new Date(afterDate)
    dayAfter.setDate(dayAfter.getDate() + 1)
    let candidate = nextOnOrAfter(dayAfter)
    const anchorDay = startOfLocalDay(anchor)
    if (candidate < anchorDay) candidate = nextOnOrAfter(anchorDay)
    return toLocalDateKey(candidate)
  }

  return (
    rule.date
      .map(toLocalDateKey)
      .filter((dateKey) => dateKey > afterDateKey)
      .sort()
      .at(0) ?? null
  )
}

/**
 * Enumerates the calendar days within `[now, now + days)` on which `rule` would
 * fire, anchored at `anchor`. Optional `windowStart` / `windowEnd` clip the
 * range (inclusive) for task triggers with a validity window. Returns ascending
 * `LocalDateKey`s. Unlike {@link getPendingTriggerDateKey} this looks forward —
 * it is purely date-derived (no runtime state).
 */
export function getUpcomingTriggerDateKeys(options: {
  rule: triggerRule
  anchor: Date
  now: Date
  days: number
  windowStart?: Date
  windowEnd?: Date
}): LocalDateKey[] {
  const { rule, anchor, now, days, windowStart, windowEnd } = options
  const start = startOfLocalDay(now)
  const windowStartDay = windowStart ? startOfLocalDay(windowStart) : undefined
  const windowEndDay = windowEnd ? startOfLocalDay(windowEnd) : undefined

  const keys: LocalDateKey[] = []
  for (let offset = 0; offset < days; offset++) {
    const day = new Date(start)
    day.setDate(day.getDate() + offset)

    if (windowStartDay && day < windowStartDay) continue
    if (windowEndDay && day > windowEndDay) continue
    if (ruleFiresOnDate(rule, anchor, day)) {
      keys.push(toLocalDateKey(day))
    }
  }

  return keys
}
