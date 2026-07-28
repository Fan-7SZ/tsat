import type { SelectTriggerMode } from "@/components/trigger/TriggerPanel"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import type { Dictionary } from "@/i18n/types"

export function buildDefaultTriggerRule(
  mode: Exclude<SelectTriggerMode, null>
): triggerRule {
  if (mode === "weekly") {
    return { mode: "weekly", interval: 1, daysOfWeek: [] } satisfies triggerRule
  }

  if (mode === "monthly") {
    return { mode: "monthly", dayOfMonth: 1 } satisfies triggerRule
  }

  if (mode === "custom") {
    return { mode: "custom", date: [] } satisfies triggerRule
  }

  return { mode: "daily", interval: 1 } satisfies triggerRule
}

export function getTriggerModeLabel(
  mode: Exclude<SelectTriggerMode, null>,
  t: Dictionary
): string {
  if (mode === "weekly") return t.createGoal.triggerWeekly
  if (mode === "monthly") return t.createGoal.triggerMonthly
  if (mode === "custom") return t.createGoal.triggerCustom
  return t.createGoal.triggerDaily
}

export function validateTriggerDraft(
  rule: triggerRule | null,
  t: Dictionary
): string | null {
  if (!rule) return t.createGoal.invalidTrigger

  if (rule.mode === "daily" && rule.interval < 1) {
    return t.createGoal.triggerDailyIntervalRequired
  }

  if (rule.mode === "weekly") {
    if (rule.daysOfWeek.length === 0) {
      return t.createGoal.triggerWeeklyDaysRequired
    }

    if (rule.interval < 1) {
      return t.createGoal.triggerWeeklyIntervalRequired
    }
  }

  if (
    rule.mode === "monthly" &&
    (rule.dayOfMonth < 1 || rule.dayOfMonth > 31)
  ) {
    return t.createGoal.triggerMonthlyDayRequired
  }

  if (rule.mode === "custom" && rule.date.length === 0) {
    return t.createGoal.triggerCustomDatesRequired
  }

  return null
}
