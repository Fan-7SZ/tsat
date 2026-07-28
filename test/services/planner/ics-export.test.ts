import { afterEach, describe, expect, it, vi } from "vitest"

import {
  downloadICS,
  generateICS,
  type IcsEvent,
} from "@/services/planner/ics-export"
import type { LocalDateKey } from "@/domain/value-objects/schemas"

const day = (key: string) => key as LocalDateKey

function event(overrides: Partial<IcsEvent> = {}): IcsEvent {
  return {
    title: "Write report",
    dateKey: day("2026-07-01"),
    startMinute: 9 * 60 + 30,
    durationMinutes: 45,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("generateICS", () => {
  it("returns null for an empty event list", async () => {
    await expect(generateICS([])).resolves.toBeNull()
  })

  it("produces a text/calendar blob with one VEVENT per event", async () => {
    const blob = await generateICS([
      event(),
      event({ title: "Second", startMinute: 14 * 60, durationMinutes: 30 }),
    ])

    expect(blob).not.toBeNull()
    expect(blob!.type).toBe("text/calendar;charset=utf-8")
    const text = await blob!.text()
    expect(text).toContain("BEGIN:VCALENDAR")
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(text).toContain("SUMMARY:Write report")
    expect(text).toContain("SUMMARY:Second")
    expect(text).toContain("STATUS:CONFIRMED")
  })

  it("derives start/end times from startMinute and durationMinutes", async () => {
    // 9:30 + 45min = 10:15 on 2026-07-01 (local time; the lib emits UTC).
    const blob = await generateICS([event()])
    const text = await blob!.text()
    const parseUtcStamp = (stamp: string): number => {
      const m = stamp.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/)!
      return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
    }
    const start = text.match(/DTSTART:(\d{8}T\d{6})Z/)![1]
    const end = text.match(/DTEND:(\d{8}T\d{6})Z/)![1]
    expect(parseUtcStamp(start)).toBe(new Date(2026, 6, 1, 9, 30).getTime())
    expect(parseUtcStamp(end) - parseUtcStamp(start)).toBe(45 * 60 * 1000)
  })

  it("handles an end time crossing the hour boundary from a late start", async () => {
    // 23:30 + 60min = 24:30 (hour 24, minute 30)
    const blob = await generateICS([
      event({ startMinute: 23 * 60 + 30, durationMinutes: 60 }),
    ])
    // The ics lib may normalize or reject hour 24; the function only promises
    // a blob or null, never a throw.
    expect(blob === null || blob instanceof Blob).toBe(true)
  })

  it("falls back to 'Task' for an empty title", async () => {
    const blob = await generateICS([event({ title: "" })])
    const text = await blob!.text()
    expect(text).toContain("SUMMARY:Task")
  })

  it("returns null when the ics library rejects invalid values", async () => {
    const blob = await generateICS([event({ dateKey: day("not-a-date") })])
    expect(blob).toBeNull()
  })
})

describe("downloadICS", () => {
  it("creates an object URL, clicks a temp anchor, and cleans up", () => {
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
    }
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body: { appendChild, removeChild },
    })
    const createObjectURL = vi.fn(() => "blob:fake-url")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })

    const blob = new Blob(["x"], { type: "text/calendar" })
    downloadICS(blob, "my.ics")

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(anchor.href).toBe("blob:fake-url")
    expect(anchor.download).toBe("my.ics")
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(removeChild).toHaveBeenCalledWith(anchor)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url")
  })

  it("defaults the filename to schedule.ics", () => {
    const anchor = { href: "", download: "", click: vi.fn() }
    vi.stubGlobal("document", {
      createElement: () => anchor,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    })
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:u",
      revokeObjectURL: vi.fn(),
    })

    downloadICS(new Blob(["x"]))
    expect(anchor.download).toBe("schedule.ics")
  })
})
