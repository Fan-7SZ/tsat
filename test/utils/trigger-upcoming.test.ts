import { describe, expect, it } from "vitest"

import type { triggerRule } from "@/domain/value-objects/triggerRule"
import { getUpcomingTriggerDateKeys } from "@/utils/trigger-evaluation"

const now = new Date("2026-06-13T09:00:00") // Saturday

function run(
  rule: triggerRule,
  extra: Partial<Parameters<typeof getUpcomingTriggerDateKeys>[0]> = {}
) {
  return getUpcomingTriggerDateKeys({
    rule,
    anchor: new Date("2026-06-01T00:00:00"),
    now,
    days: 14,
    ...extra,
  })
}

describe("getUpcomingTriggerDateKeys", () => {
  it("daily interval 1 lists every day in the window", () => {
    const keys = run({ mode: "daily", interval: 1 })
    expect(keys).toHaveLength(14)
    expect(keys[0]).toBe("2026-06-13")
    expect(keys.at(-1)).toBe("2026-06-26")
  })

  it("daily interval 3 lists only matching days", () => {
    // anchor 2026-06-01, every 3 days → ...06-13, 06-16, 06-19, 06-22, 06-25
    const keys = run({ mode: "daily", interval: 3 })
    expect(keys).toEqual([
      "2026-06-13",
      "2026-06-16",
      "2026-06-19",
      "2026-06-22",
      "2026-06-25",
    ])
  })

  it("weekly lists matching weekdays in the window", () => {
    // Thursdays within 06-13..06-26
    const keys = run({ mode: "weekly", interval: 1, daysOfWeek: [4] })
    expect(keys).toEqual(["2026-06-18", "2026-06-25"])
  })

  it("custom lists only dates inside the window", () => {
    const keys = run({
      mode: "custom",
      date: [
        new Date("2026-06-15T08:00:00"),
        new Date("2026-06-20T08:00:00"),
        new Date("2026-07-10T08:00:00"), // outside the 14-day window
      ],
    })
    expect(keys).toEqual(["2026-06-15", "2026-06-20"])
  })

  it("clips to the validity window (windowStart / windowEnd, inclusive)", () => {
    const keys = run(
      { mode: "daily", interval: 1 },
      {
        windowStart: new Date("2026-06-20T00:00:00"),
        windowEnd: new Date("2026-06-22T23:59:59"),
      }
    )
    expect(keys).toEqual(["2026-06-20", "2026-06-21", "2026-06-22"])
  })

  it("does not list days before the anchor", () => {
    const keys = run(
      { mode: "daily", interval: 1 },
      { anchor: new Date("2026-06-20T00:00:00") }
    )
    expect(keys[0]).toBe("2026-06-20")
    expect(keys).not.toContain("2026-06-13")
  })
})
