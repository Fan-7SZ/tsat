import { describe, expect, it } from "vitest"

import {
  clampMinOne,
  computePlannedExecutionDates,
  computeProjectedConductedCount,
} from "@/utils/repeat-count"

const keysOf = (dates: Date[]) =>
  dates.map(
    (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
  )

describe("clampMinOne", () => {
  it("passes valid integers >= 1 through", () => {
    expect(clampMinOne(1)).toBe(1)
    expect(clampMinOne(5)).toBe(5)
  })

  it("floors fractional values", () => {
    expect(clampMinOne(2.9)).toBe(2)
  })

  it("clamps zero and negatives up to 1", () => {
    expect(clampMinOne(0)).toBe(1)
    expect(clampMinOne(-3)).toBe(1)
  })

  it("falls back to 1 for undefined, NaN and Infinity", () => {
    expect(clampMinOne(undefined)).toBe(1)
    expect(clampMinOne(Number.NaN)).toBe(1)
    expect(clampMinOne(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe("computePlannedExecutionDates", () => {
  it("returns [] when the end is before the start", () => {
    expect(
      computePlannedExecutionDates(
        new Date("2026-05-10T00:00:00"),
        new Date("2026-05-01T00:00:00"),
        { mode: "daily", interval: 1 }
      )
    ).toEqual([])
  })

  it("lists every day for daily interval 1, time-of-day ignored", () => {
    const dates = computePlannedExecutionDates(
      new Date("2026-05-01T15:30:00"),
      new Date("2026-05-04T08:00:00"),
      { mode: "daily", interval: 1 }
    )

    expect(keysOf(dates)).toEqual([
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
      "2026-05-04",
    ])
    expect(dates[0]?.getHours()).toBe(0)
  })

  it("steps by the daily interval", () => {
    const dates = computePlannedExecutionDates(
      new Date("2026-05-01T00:00:00"),
      new Date("2026-05-07T00:00:00"),
      { mode: "daily", interval: 2 }
    )

    expect(keysOf(dates)).toEqual([
      "2026-05-01",
      "2026-05-03",
      "2026-05-05",
      "2026-05-07",
    ])
  })

  it("clamps a non-positive daily interval to 1", () => {
    const dates = computePlannedExecutionDates(
      new Date("2026-05-01T00:00:00"),
      new Date("2026-05-03T00:00:00"),
      { mode: "daily", interval: 0 }
    )

    expect(dates).toHaveLength(3)
  })

  it("weekly picks only the chosen weekdays", () => {
    // 2026-05-04 is a Monday; daysOfWeek 1=Mon, 4=Thu.
    const dates = computePlannedExecutionDates(
      new Date("2026-05-04T00:00:00"),
      new Date("2026-05-17T00:00:00"),
      { mode: "weekly", interval: 1, daysOfWeek: [1, 4] }
    )

    expect(keysOf(dates)).toEqual([
      "2026-05-04",
      "2026-05-07",
      "2026-05-11",
      "2026-05-14",
    ])
  })

  it("weekly interval 2 skips the off weeks (weeks anchored on Sunday)", () => {
    const dates = computePlannedExecutionDates(
      new Date("2026-05-04T00:00:00"),
      new Date("2026-05-17T00:00:00"),
      { mode: "weekly", interval: 2, daysOfWeek: [1, 4] }
    )

    expect(keysOf(dates)).toEqual(["2026-05-04", "2026-05-07"])
  })

  it("weekly with no weekdays selected yields no dates", () => {
    expect(
      computePlannedExecutionDates(
        new Date("2026-05-04T00:00:00"),
        new Date("2026-05-17T00:00:00"),
        { mode: "weekly", interval: 1, daysOfWeek: [] }
      )
    ).toEqual([])
  })
})

describe("computeProjectedConductedCount", () => {
  it("counts the planned dates", () => {
    expect(
      computeProjectedConductedCount(
        new Date("2026-05-01T00:00:00"),
        new Date("2026-05-03T00:00:00"),
        { mode: "daily", interval: 1 }
      )
    ).toBe(3)
  })

  it("reports 0 when nothing is planned in the window", () => {
    expect(
      computeProjectedConductedCount(
        new Date("2026-05-04T00:00:00"),
        new Date("2026-05-17T00:00:00"),
        { mode: "weekly", interval: 1, daysOfWeek: [] }
      )
    ).toBe(0)
  })
})
