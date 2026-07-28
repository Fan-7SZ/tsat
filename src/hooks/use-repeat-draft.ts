import { useMemo } from "react"

import type { DependencyEntity } from "@/domain/entities/DependencyEntity"
import type { GoalEntity } from "@/domain/entities/GoalEntity"
import type {
  TaskGroupEntity,
  TaskRepeatConfig,
} from "@/domain/entities/TaskGroupEntity"
import type { ActiveRepeatRule } from "@/domain/value-objects/repeatRule"
import type { ID } from "@/domain/value-objects/types"
import type { RepeatPeriodDraftValue } from "@/components/task/RepeatPeriodPicker"
import { computePlannedExecutionDates } from "@/utils/repeat-count"
import {
  validateRepeatConfiguration,
  validateTriggerWindowConfiguration,
  type RepeatValidationError,
  type RepeatValidationResult,
} from "@/utils/repeat-validation"
import { toClosedDayRange, type ClosedDayRange } from "@/utils/repeat-window"

export const repeatCalendarModifierClassNames = {
  ancestorRepeat:
    "[&>button]:bg-amber-100/80 [&>button]:text-amber-950 dark:[&>button]:bg-amber-950/40 dark:[&>button]:text-amber-100",
  currentRepeat:
    "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-semibold",
  planned:
    "[&>button]:outline [&>button]:outline-1 [&>button]:outline-primary/70 [&>button]:outline-offset-[-2px]",
} as const

export const previewCalendarModifierClassNames = {
  planned:
    "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-semibold [&>button]:outline [&>button]:outline-2 [&>button]:outline-primary [&>button]:outline-offset-[-2px]",
} as const

export interface UseRepeatDraftInput {
  mode: "none" | "daily" | "weekly"
  interval?: number
  daysOfWeek?: number[]
  startsAt?: Date
  endsAt?: Date
  goal?: Pick<GoalEntity, "dueAt">
  fallbackStart: Date
  dependency?: DependencyEntity | null
  currentNodeData?: ID
  tasksById?: Record<string, TaskGroupEntity | undefined>
  /** Caller-supplied copy so the hook stays i18n-agnostic. */
  messages: { periodRequired: string; pickBothDates: string }
  /** Caller-supplied localizer for schedule validation errors. */
  resolveError?: (error: RepeatValidationError) => string
  total?: number
  totalExceedsMessage?: (max: number) => string
}

export interface UseRepeatDraftResult {
  rule: ActiveRepeatRule | undefined
  draftConfig: TaskRepeatConfig | undefined
  validation: RepeatValidationResult
  explicitRange: ClosedDayRange | undefined
  periodDraftValue: RepeatPeriodDraftValue | undefined
  periodMessage: string | null
  plannedDates: Date[]
  totalLimitMessage: string | null
  calendarModifiers: {
    ancestorRepeat: Array<{ from: Date; to: Date }>
    currentRepeat: { from: Date; to: Date } | never[]
    planned: Date[]
  }
  calendarModifierClassNames: typeof repeatCalendarModifierClassNames
  previewModifiers: { planned: Date[] }
  previewModifierClassNames: typeof previewCalendarModifierClassNames
}

/**
 * Shared derivation pipeline for a repeat-rule draft: rule assembly,
 * validation, period message selection, planned dates and calendar highlight
 * modifiers. Pure computation over caller-owned draft values — no i18n, form
 * or store access, mirroring the controlled-component principle on the logic
 * side. Callers (TaskDetail, CreateTaskDialog) keep their own
 * state model and feed raw values in.
 */
export function useRepeatDraft(
  input: UseRepeatDraftInput
): UseRepeatDraftResult {
  const {
    mode,
    interval,
    daysOfWeek,
    startsAt,
    endsAt,
    goal,
    fallbackStart,
    dependency,
    currentNodeData,
    tasksById,
    messages,
    resolveError,
    total,
    totalExceedsMessage,
  } = input

  const rule = useMemo<ActiveRepeatRule | undefined>(() => {
    if (mode === "daily") {
      return { mode: "daily", interval: interval ?? 1 }
    }

    if (mode === "weekly") {
      return {
        mode: "weekly",
        interval: interval ?? 1,
        daysOfWeek: daysOfWeek ?? [],
      }
    }

    return undefined
  }, [daysOfWeek, interval, mode])

  const draftConfig = useMemo<TaskRepeatConfig | undefined>(
    () => (rule ? { rule, startsAt, endsAt } : undefined),
    [endsAt, rule, startsAt]
  )

  const validation = useMemo(
    () =>
      validateRepeatConfiguration({
        repeat: draftConfig,
        goal,
        fallbackStart,
        dependency,
        currentNodeData,
        tasksById,
      }),
    [currentNodeData, dependency, draftConfig, fallbackStart, goal, tasksById]
  )

  const explicitRange = useMemo(
    () => toClosedDayRange(startsAt, endsAt) ?? undefined,
    [endsAt, startsAt]
  )

  const periodDraftValue = useMemo<RepeatPeriodDraftValue | undefined>(() => {
    if (mode === "none") {
      return undefined
    }

    return explicitRange
      ? { start: explicitRange.start, end: explicitRange.end }
      : undefined
  }, [explicitRange, mode])

  const periodMessage = useMemo(() => {
    if (mode === "none") {
      return null
    }

    if (!startsAt && !endsAt) {
      return messages.periodRequired
    }

    if (!startsAt || !endsAt) {
      return messages.pickBothDates
    }

    if (!validation.error) {
      return null
    }

    return resolveError?.(validation.error) ?? validation.error.message
  }, [
    endsAt,
    messages.periodRequired,
    messages.pickBothDates,
    mode,
    resolveError,
    startsAt,
    validation.error,
  ])

  const plannedDates = useMemo(() => {
    if (!explicitRange || !rule || validation.error) {
      return []
    }

    return computePlannedExecutionDates(
      explicitRange.start,
      explicitRange.end,
      rule
    )
  }, [explicitRange, rule, validation.error])

  const totalLimitMessage = useMemo(() => {
    if (
      mode === "none" ||
      plannedDates.length === 0 ||
      total == null ||
      totalExceedsMessage == null
    ) {
      return null
    }

    return total > plannedDates.length
      ? totalExceedsMessage(plannedDates.length)
      : null
  }, [mode, plannedDates, total, totalExceedsMessage])

  const calendarModifiers = useMemo(
    () => ({
      // Both predecessors and successors on the dependency chain are shown in
      // the same colour as a soft, non-blocking hint. Their windows may overlap
      // the current selection freely — ordering is enforced by the planner.
      ancestorRepeat: [
        ...validation.ancestorRanges,
        ...validation.descendantRanges,
      ].map((neighbour) => ({
        from: neighbour.range.start,
        to: neighbour.range.end,
      })),
      currentRepeat: explicitRange
        ? { from: explicitRange.start, to: explicitRange.end }
        : [],
      planned: plannedDates,
    }),
    [
      explicitRange,
      plannedDates,
      validation.ancestorRanges,
      validation.descendantRanges,
    ]
  )

  const previewModifiers = useMemo(
    () => ({ planned: plannedDates }),
    [plannedDates]
  )

  return {
    rule,
    draftConfig,
    validation,
    explicitRange,
    periodDraftValue,
    periodMessage,
    plannedDates,
    totalLimitMessage,
    calendarModifiers,
    calendarModifierClassNames: repeatCalendarModifierClassNames,
    previewModifiers,
    previewModifierClassNames: previewCalendarModifierClassNames,
  }
}

export interface UseTriggerWindowDraftInput {
  /** Gate: when false the message is suppressed (validation still computed). */
  enabled: boolean
  startsAt?: Date
  endsAt?: Date
  goal?: Pick<GoalEntity, "dueAt">
  fallbackStart: Date
  dependency?: DependencyEntity | null
  currentNodeData?: ID
  tasksById?: Record<string, TaskGroupEntity | undefined>
  pickBothMessage: string
  /** Caller-supplied localizer for schedule validation errors. */
  resolveError?: (error: RepeatValidationError) => string
}

export interface UseTriggerWindowDraftResult {
  validation: RepeatValidationResult
  message: string | null
}

/**
 * Shared derivation for a trigger validity-window draft: window/chain
 * validation plus the user-facing message. Same caller-owns-state principle
 * as useRepeatDraft.
 */
export function useTriggerWindowDraft(
  input: UseTriggerWindowDraftInput
): UseTriggerWindowDraftResult {
  const {
    enabled,
    startsAt,
    endsAt,
    goal,
    fallbackStart,
    dependency,
    currentNodeData,
    tasksById,
    pickBothMessage,
    resolveError,
  } = input

  const validation = useMemo(
    () =>
      validateTriggerWindowConfiguration({
        window: { startsAt, endsAt },
        goal,
        fallbackStart,
        dependency,
        currentNodeData,
        tasksById,
      }),
    [
      currentNodeData,
      dependency,
      endsAt,
      fallbackStart,
      goal,
      startsAt,
      tasksById,
    ]
  )

  const message = useMemo(() => {
    if (!enabled) {
      return null
    }

    if ((startsAt == null) !== (endsAt == null)) {
      return pickBothMessage
    }

    if (!validation.error) {
      return null
    }

    return resolveError?.(validation.error) ?? validation.error.message
  }, [
    enabled,
    endsAt,
    pickBothMessage,
    resolveError,
    startsAt,
    validation.error,
  ])

  return { validation, message }
}
