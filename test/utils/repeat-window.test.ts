import { describe, expect, it } from "vitest"

import {
  formatDay,
  getRepeatRangeCompleteness,
  isClosedDayRangeWithin,
  isDateOutsideGoalRange,
  resolveRepeatWindow,
  toClosedDayRange,
} from "@/utils/repeat-window"

describe("formatDay", () => {
  it("formats the day part, dropping the time", () => {
    expect(formatDay(new Date("2026-05-13T18:45:00"))).toBe("2026-05-13")
  })
})

describe("toClosedDayRange", () => {
  it("returns null when either bound is missing", () => {
    expect(toClosedDayRange(undefined, undefined)).toBeNull()
    expect(toClosedDayRange(new Date("2026-05-01T00:00:00"), undefined)).toBeNull()
    expect(toClosedDayRange(undefined, new Date("2026-05-31T00:00:00"))).toBeNull()
  })

  it("normalizes both bounds to local start of day", () => {
    const range = toClosedDayRange(
      new Date("2026-05-01T13:00:00"),
      new Date("2026-05-31T22:30:00")
    )

    expect(range?.start).toEqual(new Date("2026-05-01T00:00:00"))
    expect(range?.end).toEqual(new Date("2026-05-31T00:00:00"))
  })
})

describe("getRepeatRangeCompleteness", () => {
  it("is empty with neither bound", () => {
    expect(getRepeatRangeCompleteness(undefined, undefined)).toBe("empty")
  })

  it("is partial with only one bound", () => {
    expect(
      getRepeatRangeCompleteness(new Date("2026-05-01T00:00:00"), undefined)
    ).toBe("partial")
    expect(
      getRepeatRangeCompleteness(undefined, new Date("2026-05-31T00:00:00"))
    ).toBe("partial")
  })

  it("is complete with both bounds", () => {
    expect(
      getRepeatRangeCompleteness(
        new Date("2026-05-01T00:00:00"),
        new Date("2026-05-31T00:00:00")
      )
    ).toBe("complete")
  })
})

describe("isDateOutsideGoalRange", () => {
  const goal = { dueAt: new Date("2026-05-31T10:00:00") }

  it("is false without a goal or without a due date", () => {
    expect(isDateOutsideGoalRange(new Date("2026-06-01T00:00:00"), undefined)).toBe(
      false
    )
    expect(isDateOutsideGoalRange(new Date("2026-06-01T00:00:00"), {})).toBe(
      false
    )
  })

  it("is false on or before the due day (day precision)", () => {
    expect(isDateOutsideGoalRange(new Date("2026-05-31T23:00:00"), goal)).toBe(
      false
    )
    expect(isDateOutsideGoalRange(new Date("2026-05-15T00:00:00"), goal)).toBe(
      false
    )
  })

  it("is true after the due day; there is no lower bound", () => {
    expect(isDateOutsideGoalRange(new Date("2026-06-01T00:00:00"), goal)).toBe(
      true
    )
    // Long before the goal was even created is still fine (no start bound).
    expect(isDateOutsideGoalRange(new Date("2020-01-01T00:00:00"), goal)).toBe(
      false
    )
  })
})

describe("resolveRepeatWindow", () => {
  const fallbackStart = new Date("2026-05-01T09:00:00")

  it("returns null without an explicit end", () => {
    expect(resolveRepeatWindow(fallbackStart, new Date(), undefined)).toBeNull()
    expect(resolveRepeatWindow(fallbackStart)).toBeNull()
  })

  it("uses the explicit start when given", () => {
    const range = resolveRepeatWindow(
      fallbackStart,
      new Date("2026-05-10T12:00:00"),
      new Date("2026-05-20T12:00:00")
    )

    expect(range?.start).toEqual(new Date("2026-05-10T00:00:00"))
    expect(range?.end).toEqual(new Date("2026-05-20T00:00:00"))
  })

  it("falls back to the anchor when the repeat has no start", () => {
    const range = resolveRepeatWindow(
      fallbackStart,
      undefined,
      new Date("2026-05-20T00:00:00")
    )

    expect(range?.start).toEqual(new Date("2026-05-01T00:00:00"))
  })
})

describe("isClosedDayRangeWithin", () => {
  const container = {
    start: new Date("2026-05-01T00:00:00"),
    end: new Date("2026-05-31T00:00:00"),
  }

  it("accepts a range inside the container (bounds inclusive)", () => {
    expect(isClosedDayRangeWithin(container, container)).toBe(true)
    expect(
      isClosedDayRangeWithin(
        {
          start: new Date("2026-05-10T00:00:00"),
          end: new Date("2026-05-20T00:00:00"),
        },
        container
      )
    ).toBe(true)
  })

  it("rejects a range leaking out on either side", () => {
    expect(
      isClosedDayRangeWithin(
        {
          start: new Date("2026-04-30T00:00:00"),
          end: new Date("2026-05-20T00:00:00"),
        },
        container
      )
    ).toBe(false)
    expect(
      isClosedDayRangeWithin(
        {
          start: new Date("2026-05-10T00:00:00"),
          end: new Date("2026-06-01T00:00:00"),
        },
        container
      )
    ).toBe(false)
  })
})
