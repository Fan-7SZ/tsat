import type { ActiveRepeatRule } from "@/domain/value-objects/repeatRule"

const DAY_MS = 24 * 60 * 60 * 1000

function toDayStart(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function clampMinOne(value: number | undefined): number {
  if (
    typeof value !== "number" ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    return 1
  }

  return Math.max(1, Math.floor(value))
}

function computeDailyDates(start: Date, end: Date, interval: number): Date[] {
  const safeInterval = clampMinOne(interval)
  const results: Date[] = []

  for (
    let current = new Date(start);
    current.getTime() <= end.getTime();
    current = new Date(current.getTime() + safeInterval * DAY_MS)
  ) {
    results.push(new Date(current))
  }

  return results
}

function computeWeeklyDates(
  start: Date,
  end: Date,
  interval: number,
  daysOfWeek: number[]
): Date[] {
  const safeInterval = clampMinOne(interval)
  const pickedDays = new Set(daysOfWeek)

  if (pickedDays.size === 0) {
    return []
  }

  const startWeek = new Date(start)
  startWeek.setDate(startWeek.getDate() - startWeek.getDay())
  startWeek.setHours(0, 0, 0, 0)

  const results: Date[] = []
  for (
    let current = new Date(start);
    current.getTime() <= end.getTime();
    current = new Date(current.getTime() + DAY_MS)
  ) {
    if (!pickedDays.has(current.getDay())) {
      continue
    }

    const weekOffset = Math.floor(
      (current.getTime() - startWeek.getTime()) / (7 * DAY_MS)
    )

    if (weekOffset % safeInterval === 0) {
      results.push(new Date(current))
    }
  }

  return results
}

export function computePlannedExecutionDates(
  startAt: Date,
  endAt: Date,
  rule: ActiveRepeatRule
): Date[] {
  const start = toDayStart(startAt)
  const end = toDayStart(endAt)

  if (end.getTime() < start.getTime()) {
    return []
  }

  if (rule.mode === "daily") {
    return computeDailyDates(start, end, rule.interval)
  }

  return computeWeeklyDates(start, end, rule.interval, rule.daysOfWeek)
}

export function computeProjectedConductedCount(
  startAt: Date,
  endAt: Date,
  rule: ActiveRepeatRule
): number {
  return computePlannedExecutionDates(startAt, endAt, rule).length
}
