import { describe, expect, it } from "vitest"

import { en } from "@/i18n/en"
import { summarizeRepeatRule, summarizeTriggerRule } from "@/utils/rule-summary"

describe("summarizeRepeatRule", () => {
  it("summarizes daily interval 1", () => {
    expect(summarizeRepeatRule({ mode: "daily", interval: 1 }, en)).toBe(
      "Daily"
    )
  })

  it("summarizes daily interval n", () => {
    expect(summarizeRepeatRule({ mode: "daily", interval: 3 }, en)).toBe(
      "Every 3 days"
    )
  })

  it("summarizes weekly interval 1 with sorted day names", () => {
    expect(
      summarizeRepeatRule({ mode: "weekly", interval: 1, daysOfWeek: [4, 1] }, en)
    ).toBe("Weekly on Mon, Thu")
  })

  it("summarizes weekly interval n", () => {
    expect(
      summarizeRepeatRule({ mode: "weekly", interval: 2, daysOfWeek: [0, 6] }, en)
    ).toBe("Every 2 weeks on Sun, Sat")
  })

  it("falls back to the numeric day for an out-of-range weekday", () => {
    expect(
      summarizeRepeatRule({ mode: "weekly", interval: 1, daysOfWeek: [7] }, en)
    ).toBe("Weekly on 7")
  })
})

describe("summarizeTriggerRule", () => {
  it("summarizes a monthly rule", () => {
    expect(summarizeTriggerRule({ mode: "monthly", dayOfMonth: 15 }, en)).toBe(
      "Monthly on day 15"
    )
  })

  it("summarizes a custom rule", () => {
    expect(
      summarizeTriggerRule(
        { mode: "custom", date: [new Date("2026-05-13T00:00:00")] },
        en
      )
    ).toBe("Custom dates")
  })

  it("delegates daily/weekly to the repeat summary", () => {
    expect(summarizeTriggerRule({ mode: "daily", interval: 1 }, en)).toBe(
      "Daily"
    )
    expect(
      summarizeTriggerRule({ mode: "weekly", interval: 1, daysOfWeek: [2] }, en)
    ).toBe("Weekly on Tue")
  })
})
