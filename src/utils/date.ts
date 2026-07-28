import {
  LocalDateKeySchema,
  type LocalDateKey,
} from "@/domain/value-objects/schemas"

/** Merge a date (day part) with a "HH:mm" time string into a single Date. */
export function mergeDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number)
  const result = new Date(date)
  result.setHours(h ?? 0, m ?? 0, 0, 0)
  return result
}

/** Return today's 23:59:59.999 as an ISO string. */
export function endOfTodayISO(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

/** Return the local end of the given date. */
export function endOfLocalDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

/** Return the local end of a YYYY-MM-DD date key. */
export function endOfLocalDateKey(dateKey: LocalDateKey): Date {
  return endOfLocalDay(parseDateKey(dateKey))
}

/** Parse a "YYYY-MM-DD" date key into a Date at local midnight. */
export function parseDateKey(dateKey: LocalDateKey): Date {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

/** Return the ms until next local midnight (00:00:00.000 tomorrow). */
export function msUntilMidnight(): number {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.getTime() - now.getTime()
}

/** Extract "HH:mm" from a Date. Returns "00:00" for invalid input. */
export function timeStringFromDate(date: Date | undefined): string {
  if (!date || isNaN(date.getTime())) return "00:00"
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

/** Return a "YYYY-MM-DD" date key in the user's local timezone. */
export function toLocalDateKey(date: Date): LocalDateKey {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return LocalDateKeySchema.parse(`${y}-${m}-${d}`)
}
