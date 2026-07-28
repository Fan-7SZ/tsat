import { createEvents, type EventAttributes } from "ics"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

/** A single calendar event, decoupled from any store/entity shape. */
export interface IcsEvent {
  title: string
  dateKey: LocalDateKey
  startMinute: number
  durationMinutes: number
}

/**
 * Generate an .ics file blob from a flat list of events. Each event becomes a
 * VEVENT with start/end times derived from startMinute / durationMinutes.
 */
export async function generateICS(
  events: IcsEvent[]
): Promise<Blob | null> {
  if (events.length === 0) return null

  const calendarEvents: EventAttributes[] = events.map((event) => {
    const [year, month, day] = event.dateKey.split("-").map(Number) as [
      number,
      number,
      number,
    ]
    const startHour = Math.floor(event.startMinute / 60)
    const startMin = event.startMinute % 60
    const endMinute = event.startMinute + event.durationMinutes
    const endHour = Math.floor(endMinute / 60)
    const endMin = endMinute % 60

    return {
      title: event.title || "Task",
      start: [year, month, day, startHour, startMin],
      end: [year, month, day, endHour, endMin],
      status: "CONFIRMED" as const,
    }
  })

  const { error, value } = createEvents(calendarEvents)
  if (error || !value) return null

  return new Blob([value], { type: "text/calendar;charset=utf-8" })
}

/** Trigger a browser download of the .ics blob. */
export function downloadICS(blob: Blob, filename = "schedule.ics") {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
