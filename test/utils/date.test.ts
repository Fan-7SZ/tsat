import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  endOfLocalDateKey,
  endOfLocalDay,
  endOfTodayISO,
  mergeDateAndTime,
  msUntilMidnight,
  parseDateKey,
  timeStringFromDate,
  toLocalDateKey,
} from "@/utils/date"
import { LocalDateKeySchema } from "@/domain/value-objects/schemas"

describe("endOfLocalDateKey", () => {
  it("returns the local end of the requested date key", () => {
    const result = endOfLocalDateKey(LocalDateKeySchema.parse("2026-05-13"))

    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(4)
    expect(result.getDate()).toBe(13)
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
    expect(result.getMilliseconds()).toBe(999)
  })
})

describe("mergeDateAndTime", () => {
  it("keeps the day part and applies the HH:mm time", () => {
    const result = mergeDateAndTime(new Date("2026-05-13T08:15:30"), "21:45")

    expect(toLocalDateKey(result)).toBe("2026-05-13")
    expect(result.getHours()).toBe(21)
    expect(result.getMinutes()).toBe(45)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })

  it("defaults missing parts to 0", () => {
    const result = mergeDateAndTime(new Date("2026-05-13T08:15:30"), "")

    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })

  it("does not mutate the input date", () => {
    const input = new Date("2026-05-13T08:15:30")
    mergeDateAndTime(input, "21:45")

    expect(input.getHours()).toBe(8)
  })
})

describe("endOfLocalDay", () => {
  it("returns 23:59:59.999 of the same local day", () => {
    const result = endOfLocalDay(new Date("2026-05-13T08:15:30"))

    expect(toLocalDateKey(result)).toBe("2026-05-13")
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
    expect(result.getMilliseconds()).toBe(999)
  })
})

describe("parseDateKey", () => {
  it("parses a date key to local midnight", () => {
    const result = parseDateKey(LocalDateKeySchema.parse("2026-05-13"))

    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(4)
    expect(result.getDate()).toBe(13)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
  })
})

describe("timeStringFromDate", () => {
  it("extracts a zero-padded HH:mm", () => {
    expect(timeStringFromDate(new Date("2026-05-13T09:05:00"))).toBe("09:05")
  })

  it("returns 00:00 for undefined or invalid dates", () => {
    expect(timeStringFromDate(undefined)).toBe("00:00")
    expect(timeStringFromDate(new Date("not-a-date"))).toBe("00:00")
  })
})

describe("toLocalDateKey", () => {
  it("formats a local YYYY-MM-DD key with zero padding", () => {
    expect(toLocalDateKey(new Date("2026-05-03T23:59:59"))).toBe("2026-05-03")
    expect(toLocalDateKey(new Date("2026-11-30T00:00:00"))).toBe("2026-11-30")
  })
})

describe("clock-based helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-13T22:30:00"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("endOfTodayISO returns today's 23:59:59.999 as an ISO string", () => {
    const expected = new Date("2026-05-13T23:59:59.999")
    expect(endOfTodayISO()).toBe(expected.toISOString())
  })

  it("msUntilMidnight counts down to next local midnight", () => {
    // 22:30:00 → 1.5 hours until 00:00 tomorrow.
    expect(msUntilMidnight()).toBe(1.5 * 60 * 60 * 1000)
  })
})
