import type { ActiveRepeatRule } from "@/domain/value-objects/repeatRule"
import type { triggerRule } from "@/domain/value-objects/triggerRule"
import type { Dictionary } from "@/i18n/types"

function joinDays(daysOfWeek: number[], t: Dictionary): string {
  return [...daysOfWeek]
    .sort((a, b) => a - b)
    .map((d) => t.weekdays[d] ?? String(d))
    .join(", ")
}

/** Localized cadence summary for a repeat rule, e.g. "Weekly on Mon, Thu". */
export function summarizeRepeatRule(
  rule: ActiveRepeatRule,
  t: Dictionary
): string {
  if (rule.mode === "daily") {
    return rule.interval === 1
      ? t.pullUpInfo.cadenceDaily
      : t.pullUpInfo.cadenceEveryNDays(rule.interval)
  }
  const days = joinDays(rule.daysOfWeek, t)
  return rule.interval === 1
    ? t.pullUpInfo.cadenceWeekly(days)
    : t.pullUpInfo.cadenceEveryNWeeks(rule.interval, days)
}

/** Localized cadence summary for a trigger rule (adds the custom-dates case). */
export function summarizeTriggerRule(
  rule: triggerRule,
  t: Dictionary
): string {
  if (rule.mode === "monthly") {
    return t.pullUpInfo.cadenceMonthly(rule.dayOfMonth)
  }
  if (rule.mode === "custom") {
    return t.pullUpInfo.cadenceCustom
  }
  // daily / weekly share the repeat rule shape.
  return summarizeRepeatRule(rule, t)
}
