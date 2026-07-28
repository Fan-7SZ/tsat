import { describe, expect, it } from "vitest"

import { en } from "@/i18n/en"
import {
  buildDefaultTriggerRule,
  getTriggerModeLabel,
  validateTriggerDraft,
} from "@/utils/trigger-draft"

describe("buildDefaultTriggerRule", () => {
  it("builds a daily rule by default", () => {
    expect(buildDefaultTriggerRule("daily")).toEqual({
      mode: "daily",
      interval: 1,
    })
  })

  it("builds a weekly rule with no days picked yet", () => {
    expect(buildDefaultTriggerRule("weekly")).toEqual({
      mode: "weekly",
      interval: 1,
      daysOfWeek: [],
    })
  })

  it("builds a monthly rule anchored on day 1", () => {
    expect(buildDefaultTriggerRule("monthly")).toEqual({
      mode: "monthly",
      dayOfMonth: 1,
    })
  })

  it("builds a custom rule with no dates yet", () => {
    expect(buildDefaultTriggerRule("custom")).toEqual({
      mode: "custom",
      date: [],
    })
  })
})

describe("getTriggerModeLabel", () => {
  it("returns the localized label for each mode", () => {
    expect(getTriggerModeLabel("daily", en)).toBe(en.createGoal.triggerDaily)
    expect(getTriggerModeLabel("weekly", en)).toBe(en.createGoal.triggerWeekly)
    expect(getTriggerModeLabel("monthly", en)).toBe(
      en.createGoal.triggerMonthly
    )
    expect(getTriggerModeLabel("custom", en)).toBe(en.createGoal.triggerCustom)
  })
})

describe("validateTriggerDraft", () => {
  it("rejects a missing rule", () => {
    expect(validateTriggerDraft(null, en)).toBe(en.createGoal.invalidTrigger)
  })

  it("rejects a daily rule with interval < 1", () => {
    expect(validateTriggerDraft({ mode: "daily", interval: 0 }, en)).toBe(
      en.createGoal.triggerDailyIntervalRequired
    )
  })

  it("accepts a valid daily rule", () => {
    expect(validateTriggerDraft({ mode: "daily", interval: 1 }, en)).toBeNull()
  })

  it("rejects a weekly rule with no weekdays", () => {
    expect(
      validateTriggerDraft({ mode: "weekly", interval: 1, daysOfWeek: [] }, en)
    ).toBe(en.createGoal.triggerWeeklyDaysRequired)
  })

  it("rejects a weekly rule with interval < 1", () => {
    expect(
      validateTriggerDraft({ mode: "weekly", interval: 0, daysOfWeek: [1] }, en)
    ).toBe(en.createGoal.triggerWeeklyIntervalRequired)
  })

  it("accepts a valid weekly rule", () => {
    expect(
      validateTriggerDraft(
        { mode: "weekly", interval: 2, daysOfWeek: [1, 4] },
        en
      )
    ).toBeNull()
  })

  it("rejects a monthly day below 1", () => {
    expect(validateTriggerDraft({ mode: "monthly", dayOfMonth: 0 }, en)).toBe(
      en.createGoal.triggerMonthlyDayRequired
    )
  })

  it("rejects a monthly day above 31", () => {
    expect(validateTriggerDraft({ mode: "monthly", dayOfMonth: 32 }, en)).toBe(
      en.createGoal.triggerMonthlyDayRequired
    )
  })

  it("accepts a valid monthly rule", () => {
    expect(
      validateTriggerDraft({ mode: "monthly", dayOfMonth: 31 }, en)
    ).toBeNull()
  })

  it("rejects a custom rule with no dates", () => {
    expect(validateTriggerDraft({ mode: "custom", date: [] }, en)).toBe(
      en.createGoal.triggerCustomDatesRequired
    )
  })

  it("accepts a custom rule with at least one date", () => {
    expect(
      validateTriggerDraft(
        { mode: "custom", date: [new Date("2026-05-13T00:00:00")] },
        en
      )
    ).toBeNull()
  })
})
